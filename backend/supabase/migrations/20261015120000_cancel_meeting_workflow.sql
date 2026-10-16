-- Fase 4D.2B: cancelar la misma meeting, con motivo controlado e idempotencia.
-- Aplicar mediante el runner transaccional de migraciones; no ejecutar por partes.
alter table public.audit_events drop constraint audit_events_entity_action_valid;
alter table public.audit_events add constraint audit_events_entity_action_valid check (
    (entity_type = 'consultation_request' and action = 'consultation_converted')
    or (entity_type = 'meeting' and action in ('meeting_created', 'meeting_rescheduled', 'meeting_cancelled'))
);

alter table public.idempotency_records drop constraint idempotency_records_operation_valid;
alter table public.idempotency_records add constraint idempotency_records_operation_valid check (
    operation in ('create_consultation_meeting', 'reschedule_consultation_meeting', 'cancel_consultation_meeting')
);

create function public.cancel_consultation_meeting(
    p_actor_id uuid,
    p_meeting_id uuid,
    p_idempotency_key uuid,
    p_request_hash text,
    p_expected_version integer,
    p_reason text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
set timezone = 'UTC'
as $$
declare
    v_operation constant text := 'cancel_consultation_meeting';
    v_actor public.internal_users%rowtype;
    v_previous public.idempotency_records%rowtype;
    v_request public.consultation_requests%rowtype;
    v_old public.meetings%rowtype;
    v_meeting public.meetings%rowtype;
    v_parent_id uuid;
    v_response jsonb;
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
        or v_actor.role not in ('admin', 'agendadora') then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;

    select r.* into v_previous from public.idempotency_records r
        where r.actor_id = p_actor_id and r.operation = v_operation
            and r.idempotency_key = p_idempotency_key;
    if found then
        if v_previous.request_hash is distinct from p_request_hash then
            raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED';
        end if;
        v_response := v_previous.response_payload;
        -- Fallar cerrado ante una fotografia corrupta, sin leer la meeting actual.
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
            or (v_response->>'status') is distinct from 'cancelled'
            or coalesce(v_response->>'mode', '') not in ('online', 'phone', 'office')
            or length(trim(v_response->>'timeZone')) = 0 then
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
        -- Antes de version, estado y padre: devolver el resultado original.
        return v_response;
    end if;

    if p_expected_version is null or p_expected_version <= 0
        or p_reason is null or p_reason not in (
            'client_request', 'staff_unavailable', 'duplicate', 'administrative', 'other') then
        raise exception using errcode = 'P0001', message = 'INVALID_MEETING_INPUT';
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
    -- Precedencia: otra cancelacion gana -> estado; reprogramacion gana -> version.
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
    -- No hay validacion de futuro ni cambio de horario, notas, asignada o padre.
    update public.meetings set
        status = 'cancelled', updated_by = p_actor_id,
        updated_at = clock_timestamp(), version = version + 1
        where id = v_old.id returning * into v_meeting;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    insert into public.audit_events (actor_id, entity_type, entity_id, action, metadata, operation_id)
        values (p_actor_id, 'meeting', v_meeting.id, 'meeting_cancelled', jsonb_build_object(
            'consultationRequestId', v_parent_id,
            'previousStatus', v_old.status, 'newStatus', v_meeting.status,
            'previousVersion', v_old.version, 'newVersion', v_meeting.version,
            'reason', p_reason
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

revoke all privileges on function public.cancel_consultation_meeting(
    uuid, uuid, uuid, text, integer, text
) from public, anon, authenticated, service_role;
grant execute on function public.cancel_consultation_meeting(
    uuid, uuid, uuid, text, integer, text
) to service_role;
