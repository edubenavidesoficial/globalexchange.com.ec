-- 4D.3B: resultados explicitos; no aplicar por partes.
BEGIN;

alter table public.audit_events drop constraint audit_events_entity_action_valid;
alter table public.audit_events add constraint audit_events_entity_action_valid check (
    (entity_type = 'consultation_request' and action = 'consultation_converted')
    or (entity_type = 'meeting' and action in ('meeting_created', 'meeting_rescheduled',
        'meeting_cancelled', 'meeting_completed', 'meeting_no_show'))
);
alter table public.idempotency_records drop constraint idempotency_records_operation_valid;
alter table public.idempotency_records add constraint idempotency_records_operation_valid check (
    operation in ('create_consultation_meeting', 'reschedule_consultation_meeting',
        'cancel_consultation_meeting', 'complete_consultation_meeting', 'mark_consultation_meeting_no_show')
);

-- Reemplazo forward-only: completed permite otro intento; scheduled sigue excluyente.
-- Se conserva literalmente el resto del contrato de creacion y sus permisos.
create or replace function public.create_consultation_meeting(
    p_actor_id uuid,
    p_consultation_request_id uuid,
    p_idempotency_key uuid,
    p_request_hash text,
    p_scheduled_date date,
    p_scheduled_time time without time zone,
    p_time_zone text,
    p_duration_minutes integer,
    p_mode text,
    p_assigned_to uuid,
    p_notes text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
set timezone = 'UTC'
as $$
declare
    v_operation constant text := 'create_consultation_meeting';
    v_actor public.internal_users%rowtype;
    v_assignee public.internal_users%rowtype;
    v_request public.consultation_requests%rowtype;
    v_previous public.idempotency_records%rowtype;
    v_meeting public.meetings%rowtype;
    v_history_count bigint;
    v_has_scheduled boolean;
    v_has_unknown boolean;
    v_local_time timestamp without time zone;
    v_scheduled_at timestamptz;
    v_operation_id uuid;
    v_response jsonb;
    v_constraint text;
begin
    -- Cada sentencia posterior a una espera debe observar commits recientes.
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = 'P0001', message = 'WORKFLOW_ISOLATION_NOT_SUPPORTED';
    end if;
    if p_actor_id is null then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;
    if p_consultation_request_id is null or p_idempotency_key is null
        or p_request_hash is null or length(trim(p_request_hash)) = 0 then
        raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
    end if;

    -- Lock transaccional por actor/operacion/clave, incluso sin fila previa.
    -- Una colision del hash solo serializa claves distintas; no las confunde.
    perform pg_advisory_xact_lock(hashtextextended(
        v_operation || ':' || p_actor_id::text || ':' || p_idempotency_key::text, 0
    ));

    -- FOR SHARE bloquea cambios de active/role; FOR KEY SHARE no bastaria.
    select u.* into v_actor from public.internal_users u
        where u.id = p_actor_id for share;
    if not found or v_actor.active is distinct from true
        or v_actor.role not in ('admin', 'agendadora') then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;

    select r.* into v_previous from public.idempotency_records r
        where r.actor_id = p_actor_id and r.operation = v_operation
            and r.idempotency_key = p_idempotency_key;
    if found then
        if v_previous.request_hash is distinct from p_request_hash
            or v_previous.consultation_request_id is distinct from p_consultation_request_id then
            raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED';
        end if;
        -- Replay historico: no revalidar fecha, asignada ni estado de solicitud.
        return v_previous.response_payload;
    end if;

    select u.* into v_assignee from public.internal_users u
        where u.id = p_assigned_to for share;
    if not found or v_assignee.active is distinct from true
        or v_assignee.role is distinct from 'vendedora' then
        raise exception using errcode = 'P0001', message = 'ASSIGNEE_NOT_ELIGIBLE';
    end if;

    select r.* into v_request from public.consultation_requests r
        where r.id = p_consultation_request_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_NOT_FOUND';
    end if;

    select count(*), coalesce(bool_or(m.status = 'scheduled'), false),
        coalesce(bool_or(m.status is null or m.status not in
            ('scheduled', 'completed', 'cancelled', 'no_show')), false)
    into v_history_count, v_has_scheduled, v_has_unknown
    from public.meetings m where m.consultation_request_id = v_request.id;

    -- No reparar silenciosamente solicitudes legacy ni estados desconocidos.
    if v_request.status is null or v_request.status not in ('pending', 'converted', 'cancelled')
        or v_has_unknown
        or (v_request.status in ('pending', 'cancelled') and v_history_count > 0)
        or (v_request.status = 'converted' and v_history_count = 0) then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    if v_request.status = 'cancelled' then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_CANCELLED';
    end if;
    if v_has_scheduled then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_ALREADY_SCHEDULED';
    end if;

    if p_scheduled_date is null or not isfinite(p_scheduled_date)
        or p_scheduled_time is null or p_scheduled_time >= time '24:00:00'
        or p_duration_minutes is null or p_duration_minutes <= 0
        or p_mode is null or p_mode not in ('online', 'phone', 'office') then
        raise exception using errcode = 'P0001', message = 'INVALID_MEETING_INPUT';
    end if;
    if p_time_zone is null or not exists (
        select 1 from pg_catalog.pg_timezone_names z where z.name = p_time_zone
    ) then
        raise exception using errcode = 'P0001', message = 'INVALID_TIME_ZONE';
    end if;
    begin
        v_local_time := p_scheduled_date + p_scheduled_time;
        v_scheduled_at := v_local_time at time zone p_time_zone;
    exception when datetime_field_overflow then
        raise exception using errcode = 'P0001', message = 'INVALID_MEETING_INPUT';
    end;
    -- Rechazar horas inexistentes por cambio estacional (normalizacion implicita).
    if (v_scheduled_at at time zone p_time_zone) <> v_local_time then
        raise exception using errcode = 'P0001', message = 'INVALID_LOCAL_TIME';
    end if;
    -- now() es el inicio transaccional; revisar tambien el tiempo tras los locks.
    if v_scheduled_at <= now() or v_scheduled_at <= clock_timestamp() then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_IN_FUTURE';
    end if;

    begin
        insert into public.meetings (
            consultation_request_id, scheduled_at, time_zone, duration_minutes,
            mode, status, notes, assigned_to, created_by, updated_by, version
        ) values (
            v_request.id, v_scheduled_at, p_time_zone, p_duration_minutes,
            p_mode, 'scheduled', p_notes, p_assigned_to, p_actor_id, p_actor_id, 1
        ) returning * into v_meeting;
    exception when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'meetings_one_scheduled_per_consultation_idx' then
            raise exception using errcode = 'P0001', message = 'CONSULTATION_ALREADY_SCHEDULED';
        end if;
        raise;
    end;

    v_operation_id := gen_random_uuid();
    if v_request.status = 'pending' then
        update public.consultation_requests set status = 'converted', updated_at = now()
            where id = v_request.id and status = 'pending'
            returning * into v_request;
        if not found then
            raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
        end if;
        insert into public.audit_events (actor_id, entity_type, entity_id, action, metadata, operation_id)
            values (p_actor_id, 'consultation_request', v_request.id, 'consultation_converted',
                jsonb_build_object('meetingId', v_meeting.id), v_operation_id);
    end if;
    insert into public.audit_events (actor_id, entity_type, entity_id, action, metadata, operation_id)
        values (p_actor_id, 'meeting', v_meeting.id, 'meeting_created',
            jsonb_build_object('consultationRequestId', v_request.id), v_operation_id);

    v_response := jsonb_build_object(
        'consultation', jsonb_build_object(
            'id', v_request.id, 'status', v_request.status, 'updatedAt', v_request.updated_at
        ),
        'meeting', jsonb_build_object(
            'id', v_meeting.id, 'consultationRequestId', v_meeting.consultation_request_id,
            'scheduledAt', v_meeting.scheduled_at, 'timeZone', v_meeting.time_zone,
            'durationMinutes', v_meeting.duration_minutes, 'mode', v_meeting.mode,
            'status', v_meeting.status, 'assignedTo', v_meeting.assigned_to,
            'createdBy', v_meeting.created_by, 'updatedBy', v_meeting.updated_by,
            'version', v_meeting.version, 'createdAt', v_meeting.created_at,
            'updatedAt', v_meeting.updated_at
        )
    );
    insert into public.idempotency_records (
        actor_id, operation, idempotency_key, request_hash, consultation_request_id, response_payload
    ) values (
        p_actor_id, v_operation, p_idempotency_key, p_request_hash, v_request.id, v_response
    );
    return v_response;
end;
$$;

revoke all privileges on function public.create_consultation_meeting(
    uuid, uuid, uuid, text, date, time without time zone, text, integer, text, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_consultation_meeting(
    uuid, uuid, uuid, text, date, time without time zone, text, integer, text, uuid, text
) to service_role;

create function public.complete_consultation_meeting(
    p_actor_id uuid,
    p_meeting_id uuid,
    p_idempotency_key uuid,
    p_request_hash text,
    p_expected_version integer
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
set timezone = 'UTC'
as $$
declare
    v_operation constant text := 'complete_consultation_meeting';
    v_actor public.internal_users%rowtype;
    v_previous public.idempotency_records%rowtype;
    v_request public.consultation_requests%rowtype;
    v_old public.meetings%rowtype;
    v_meeting public.meetings%rowtype;
    v_parent_id uuid;
    v_response jsonb;
    v_replay boolean;
begin
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = 'P0001', message = 'WORKFLOW_ISOLATION_NOT_SUPPORTED';
    end if;
    if p_actor_id is null then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;
    if p_meeting_id is null or p_idempotency_key is null
        or p_request_hash is null or length(trim(p_request_hash)) = 0 then
        raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
        v_operation || ':' || p_actor_id::text || ':' || p_idempotency_key::text, 0
    ));
    select u.* into v_actor from public.internal_users u
        where u.id = p_actor_id for share;
    if not found or v_actor.active is distinct from true
        or v_actor.role not in ('admin', 'vendedora') then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;

    select r.* into v_previous from public.idempotency_records r
        where r.actor_id = p_actor_id and r.operation = v_operation
            and r.idempotency_key = p_idempotency_key;
    v_replay := found;
    if v_replay then
        if v_previous.request_hash is distinct from p_request_hash then
            raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED';
        end if;
        v_response := v_previous.response_payload;
        -- Validar fotografia; autorizar propiedad actual antes de devolverla.
        if jsonb_typeof(v_response) is distinct from 'object'
            or not (v_response ?& array['id', 'consultationRequestId', 'scheduledAt',
                'timeZone', 'durationMinutes', 'mode', 'status', 'version'])
            or (v_response - array['id', 'consultationRequestId', 'scheduledAt',
                'timeZone', 'durationMinutes', 'mode', 'status', 'version']) <> '{}'::jsonb
            or jsonb_typeof(v_response->'id') is distinct from 'string'
            or jsonb_typeof(v_response->'consultationRequestId') is distinct from 'string'
            or jsonb_typeof(v_response->'scheduledAt') is distinct from 'string'
            or jsonb_typeof(v_response->'timeZone') is distinct from 'string'
            or jsonb_typeof(v_response->'durationMinutes') is distinct from 'number'
            or jsonb_typeof(v_response->'version') is distinct from 'number'
            or (v_response->>'status') is distinct from 'completed'
            or coalesce(v_response->>'mode', '') not in ('online', 'phone', 'office')
            or length(trim(v_response->>'timeZone')) = 0
            or (v_response->>'durationMinutes') !~ '^[0-9]+$'
            or (v_response->>'version') !~ '^[0-9]+$' then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end if;
        -- Prefijo ISO emitido por jsonb_build_object(timestamptz), incluidos
        -- anos de mas de cuatro digitos. No aceptar tokens relativos/especiales.
        -- El cast posterior sigue validando calendario, hora y zona; no es un parser.
        if (v_response->>'scheduledAt') !~ '^[0-9]{4,}-[0-9]{2}-[0-9]{2}T' then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end if;
        begin
            if (v_response->>'consultationRequestId')::uuid is distinct from v_previous.consultation_request_id
                or not isfinite((v_response->>'scheduledAt')::timestamptz)
                or (v_response->>'durationMinutes')::integer <= 0
                or (v_response->>'version')::integer < 2 then
                raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
            end if;
            if (v_response->>'id')::uuid is distinct from p_meeting_id then
                raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED';
            end if;
        exception when invalid_text_representation or numeric_value_out_of_range
            or invalid_datetime_format or datetime_field_overflow
            or invalid_time_zone_displacement_value or invalid_parameter_value
            or config_file_error then
            -- Solo interpretacion de la fotografia: incluye offsets invalidos y
            -- zonas/abreviaturas desconocidas. P0001 no se captura aqui.
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end;

    end if;

    -- Solo descubrir el padre; esta lectura no autoriza la escritura.
    select m.consultation_request_id into v_parent_id from public.meetings m
        where m.id = p_meeting_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    -- Orden compartido con creacion y futuros workflows: padre antes de meeting.
    select r.* into v_request from public.consultation_requests r
        where r.id = v_parent_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    select m.* into v_old from public.meetings m where m.id = p_meeting_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    if v_old.id is distinct from p_meeting_id
        or v_old.consultation_request_id is distinct from v_parent_id then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    -- Padre y meeting bloqueados: propiedad estable incluso durante replay.
    if v_actor.role = 'vendedora' and v_old.assigned_to is distinct from p_actor_id then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;
    if v_replay then
        if v_previous.consultation_request_id is distinct from v_parent_id then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end if;
        -- No revalidar estado, version, tiempo ni estado mutable del padre.
        return v_response;
    end if;
    if p_expected_version is null or p_expected_version < 1 then
        raise exception using errcode = 'P0001', message = 'INVALID_MEETING_INPUT';
    end if;
    -- Comando nuevo: estado antes de version.
    if v_old.status is distinct from 'scheduled' then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_SCHEDULED';
    end if;
    if v_old.version is distinct from p_expected_version then
        raise exception using errcode = 'P0001', message = 'MEETING_VERSION_CONFLICT';
    end if;
    if v_request.status is distinct from 'converted' then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    if v_old.version = 2147483647 then
        raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
    end if;
    -- Tiempo real despues de locks, sin exigir fin de la franja.
    if clock_timestamp() < v_old.scheduled_at then
        raise exception using errcode = 'P0001', message = 'MEETING_TOO_EARLY';
    end if;
    update public.meetings set
        status = 'completed', updated_by = p_actor_id,
        updated_at = clock_timestamp(), version = version + 1
        where id = v_old.id returning * into v_meeting;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    insert into public.audit_events (actor_id, entity_type, entity_id, action, metadata, operation_id)
        values (p_actor_id, 'meeting', v_meeting.id, 'meeting_completed', jsonb_build_object(
            'consultationRequestId', v_parent_id,
            'previousStatus', v_old.status, 'newStatus', v_meeting.status,
            'previousVersion', v_old.version, 'newVersion', v_meeting.version
        ), gen_random_uuid());

    v_response := jsonb_build_object(
        'id', v_meeting.id, 'consultationRequestId', v_meeting.consultation_request_id,
        'scheduledAt', v_meeting.scheduled_at, 'timeZone', v_meeting.time_zone,
        'durationMinutes', v_meeting.duration_minutes, 'mode', v_meeting.mode,
        'status', v_meeting.status, 'version', v_meeting.version
    );
    insert into public.idempotency_records (
        actor_id, operation, idempotency_key, request_hash, consultation_request_id, response_payload
    ) values (
        p_actor_id, v_operation, p_idempotency_key, p_request_hash, v_parent_id, v_response
    );
    return v_response;
end;
$$;

revoke all privileges on function public.complete_consultation_meeting(
    uuid, uuid, uuid, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.complete_consultation_meeting(
    uuid, uuid, uuid, text, integer
) to service_role;

create function public.mark_consultation_meeting_no_show(
    p_actor_id uuid,
    p_meeting_id uuid,
    p_idempotency_key uuid,
    p_request_hash text,
    p_expected_version integer
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
set timezone = 'UTC'
as $$
declare
    v_operation constant text := 'mark_consultation_meeting_no_show';
    v_actor public.internal_users%rowtype;
    v_previous public.idempotency_records%rowtype;
    v_request public.consultation_requests%rowtype;
    v_old public.meetings%rowtype;
    v_meeting public.meetings%rowtype;
    v_parent_id uuid;
    v_response jsonb;
    v_replay boolean;
    v_end_at timestamptz;
begin
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = 'P0001', message = 'WORKFLOW_ISOLATION_NOT_SUPPORTED';
    end if;
    if p_actor_id is null then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;
    if p_meeting_id is null or p_idempotency_key is null
        or p_request_hash is null or length(trim(p_request_hash)) = 0 then
        raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
        v_operation || ':' || p_actor_id::text || ':' || p_idempotency_key::text, 0
    ));
    select u.* into v_actor from public.internal_users u
        where u.id = p_actor_id for share;
    if not found or v_actor.active is distinct from true
        or v_actor.role not in ('admin', 'vendedora') then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;

    select r.* into v_previous from public.idempotency_records r
        where r.actor_id = p_actor_id and r.operation = v_operation
            and r.idempotency_key = p_idempotency_key;
    v_replay := found;
    if v_replay then
        if v_previous.request_hash is distinct from p_request_hash then
            raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED';
        end if;
        v_response := v_previous.response_payload;
        -- Validar fotografia; autorizar propiedad actual antes de devolverla.
        if jsonb_typeof(v_response) is distinct from 'object'
            or not (v_response ?& array['id', 'consultationRequestId', 'scheduledAt',
                'timeZone', 'durationMinutes', 'mode', 'status', 'version'])
            or (v_response - array['id', 'consultationRequestId', 'scheduledAt',
                'timeZone', 'durationMinutes', 'mode', 'status', 'version']) <> '{}'::jsonb
            or jsonb_typeof(v_response->'id') is distinct from 'string'
            or jsonb_typeof(v_response->'consultationRequestId') is distinct from 'string'
            or jsonb_typeof(v_response->'scheduledAt') is distinct from 'string'
            or jsonb_typeof(v_response->'timeZone') is distinct from 'string'
            or jsonb_typeof(v_response->'durationMinutes') is distinct from 'number'
            or jsonb_typeof(v_response->'version') is distinct from 'number'
            or (v_response->>'status') is distinct from 'no_show'
            or coalesce(v_response->>'mode', '') not in ('online', 'phone', 'office')
            or length(trim(v_response->>'timeZone')) = 0
            or (v_response->>'durationMinutes') !~ '^[0-9]+$'
            or (v_response->>'version') !~ '^[0-9]+$' then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end if;
        -- Prefijo ISO emitido por jsonb_build_object(timestamptz), incluidos
        -- anos de mas de cuatro digitos. No aceptar tokens relativos/especiales.
        -- El cast posterior sigue validando calendario, hora y zona; no es un parser.
        if (v_response->>'scheduledAt') !~ '^[0-9]{4,}-[0-9]{2}-[0-9]{2}T' then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end if;
        begin
            if (v_response->>'consultationRequestId')::uuid is distinct from v_previous.consultation_request_id
                or not isfinite((v_response->>'scheduledAt')::timestamptz)
                or (v_response->>'durationMinutes')::integer <= 0
                or (v_response->>'version')::integer < 2 then
                raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
            end if;
            if (v_response->>'id')::uuid is distinct from p_meeting_id then
                raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED';
            end if;
        exception when invalid_text_representation or numeric_value_out_of_range
            or invalid_datetime_format or datetime_field_overflow
            or invalid_time_zone_displacement_value or invalid_parameter_value
            or config_file_error then
            -- Solo interpretacion de la fotografia: incluye offsets invalidos y
            -- zonas/abreviaturas desconocidas. P0001 no se captura aqui.
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end;

    end if;

    -- Solo descubrir el padre; esta lectura no autoriza la escritura.
    select m.consultation_request_id into v_parent_id from public.meetings m
        where m.id = p_meeting_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    -- Orden compartido con creacion y futuros workflows: padre antes de meeting.
    select r.* into v_request from public.consultation_requests r
        where r.id = v_parent_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    select m.* into v_old from public.meetings m where m.id = p_meeting_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    if v_old.id is distinct from p_meeting_id
        or v_old.consultation_request_id is distinct from v_parent_id then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    -- Padre y meeting bloqueados: propiedad estable incluso durante replay.
    if v_actor.role = 'vendedora' and v_old.assigned_to is distinct from p_actor_id then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;
    if v_replay then
        if v_previous.consultation_request_id is distinct from v_parent_id then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end if;
        -- No revalidar estado, version, tiempo ni estado mutable del padre.
        return v_response;
    end if;
    if p_expected_version is null or p_expected_version < 1 then
        raise exception using errcode = 'P0001', message = 'INVALID_MEETING_INPUT';
    end if;
    -- Comando nuevo: estado antes de version.
    if v_old.status is distinct from 'scheduled' then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_SCHEDULED';
    end if;
    if v_old.version is distinct from p_expected_version then
        raise exception using errcode = 'P0001', message = 'MEETING_VERSION_CONFLICT';
    end if;
    if v_request.status is distinct from 'converted' then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    if v_old.version = 2147483647 then
        raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
    end if;
    -- Solo aritmetica: no absorber P0001 ni fallos de escrituras.
    begin
        v_end_at := v_old.scheduled_at + make_interval(mins => v_old.duration_minutes);
    exception when datetime_field_overflow or interval_field_overflow
        or numeric_value_out_of_range then
        raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
    end;
    if not isfinite(v_end_at) then
        raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
    end if;
    if clock_timestamp() < v_end_at then
        raise exception using errcode = 'P0001', message = 'MEETING_TOO_EARLY';
    end if;
    update public.meetings set
        status = 'no_show', updated_by = p_actor_id,
        updated_at = clock_timestamp(), version = version + 1
        where id = v_old.id returning * into v_meeting;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    insert into public.audit_events (actor_id, entity_type, entity_id, action, metadata, operation_id)
        values (p_actor_id, 'meeting', v_meeting.id, 'meeting_no_show', jsonb_build_object(
            'consultationRequestId', v_parent_id,
            'previousStatus', v_old.status, 'newStatus', v_meeting.status,
            'previousVersion', v_old.version, 'newVersion', v_meeting.version
        ), gen_random_uuid());

    v_response := jsonb_build_object(
        'id', v_meeting.id, 'consultationRequestId', v_meeting.consultation_request_id,
        'scheduledAt', v_meeting.scheduled_at, 'timeZone', v_meeting.time_zone,
        'durationMinutes', v_meeting.duration_minutes, 'mode', v_meeting.mode,
        'status', v_meeting.status, 'version', v_meeting.version
    );
    insert into public.idempotency_records (
        actor_id, operation, idempotency_key, request_hash, consultation_request_id, response_payload
    ) values (
        p_actor_id, v_operation, p_idempotency_key, p_request_hash, v_parent_id, v_response
    );
    return v_response;
end;
$$;

revoke all privileges on function public.mark_consultation_meeting_no_show(
    uuid, uuid, uuid, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.mark_consultation_meeting_no_show(
    uuid, uuid, uuid, text, integer
) to service_role;

COMMIT;
