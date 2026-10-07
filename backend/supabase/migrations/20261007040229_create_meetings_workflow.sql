-- Fase 4B.1: solicitud -> reuniones, auditoria e idempotencia atomicas.
-- Migracion versionada: no ejecutar de nuevo sobre objetos existentes.

-- =====================================================
-- MEETINGS: HISTORIAL 1:N, UNA SOLA SCHEDULED POR SOLICITUD
-- =====================================================
create table public.meetings (
    id uuid primary key default gen_random_uuid(),
    consultation_request_id uuid not null references public.consultation_requests(id) on delete restrict,
    scheduled_at timestamptz not null,
    time_zone text not null,
    duration_minutes integer not null,
    mode text not null,
    status text not null default 'scheduled',
    notes text,
    assigned_to uuid not null references public.internal_users(id) on delete restrict,
    created_by uuid not null references public.internal_users(id) on delete restrict,
    updated_by uuid not null references public.internal_users(id) on delete restrict,
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint meetings_mode_valid check (mode in ('online', 'phone', 'office')),
    constraint meetings_status_valid check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
    constraint meetings_duration_positive check (duration_minutes > 0),
    constraint meetings_version_positive check (version > 0),
    constraint meetings_time_zone_not_blank check (length(trim(time_zone)) > 0),
    constraint meetings_scheduled_at_finite check (isfinite(scheduled_at))
);

create unique index meetings_one_scheduled_per_consultation_idx
    on public.meetings(consultation_request_id) where status = 'scheduled';
-- El indice parcial no cubre el historial de intentos terminados.
create index meetings_consultation_request_id_idx on public.meetings(consultation_request_id);
create index meetings_scheduled_at_idx on public.meetings(scheduled_at);
create index meetings_assigned_to_scheduled_at_idx on public.meetings(assigned_to, scheduled_at);

-- =====================================================
-- AUDITORIA: SIN PII, APPEND-ONLY PARA SERVICE_ROLE
-- =====================================================
create table public.audit_events (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid not null references public.internal_users(id) on delete restrict,
    entity_type text not null,
    entity_id uuid not null,
    action text not null,
    metadata jsonb not null default '{}'::jsonb,
    operation_id uuid not null,
    created_at timestamptz not null default now(),
    constraint audit_events_entity_action_valid check (
        (entity_type = 'consultation_request' and action = 'consultation_converted')
        or (entity_type = 'meeting' and action = 'meeting_created')
    ),
    constraint audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_entity_created_at_idx on public.audit_events(entity_type, entity_id, created_at);
create index audit_events_operation_id_idx on public.audit_events(operation_id);

-- =====================================================
-- IDEMPOTENCIA: SOLO SE PERSISTEN RESULTADOS COMPLETOS
-- =====================================================
create table public.idempotency_records (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid not null references public.internal_users(id) on delete restrict,
    operation text not null,
    idempotency_key uuid not null,
    request_hash text not null,
    consultation_request_id uuid not null references public.consultation_requests(id) on delete restrict,
    response_payload jsonb not null,
    created_at timestamptz not null default now(),
    constraint idempotency_records_operation_valid check (operation = 'create_consultation_meeting'),
    constraint idempotency_records_request_hash_not_blank check (length(trim(request_hash)) > 0),
    constraint idempotency_records_response_object check (jsonb_typeof(response_payload) = 'object'),
    constraint idempotency_records_actor_operation_key_unique unique (actor_id, operation, idempotency_key)
);

-- =====================================================
-- RLS Y PRIVILEGIOS EXPLICITOS (INCLUIDOS DEFAULT GRANTS)
-- =====================================================
alter table public.meetings enable row level security;
alter table public.audit_events enable row level security;
alter table public.idempotency_records enable row level security;

revoke all privileges on table public.meetings, public.audit_events, public.idempotency_records
    from public, anon, authenticated, service_role;
grant select, insert, update on table public.meetings to service_role;
grant select, insert on table public.audit_events, public.idempotency_records to service_role;

-- =====================================================
-- RPC: UNA LLAMADA, UNA TRANSACCION; SIN EFECTOS EXTERNOS
-- =====================================================
create function public.create_consultation_meeting(
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
    v_has_completed boolean;
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
        coalesce(bool_or(m.status = 'completed'), false),
        coalesce(bool_or(m.status is null or m.status not in
            ('scheduled', 'completed', 'cancelled', 'no_show')), false)
    into v_history_count, v_has_scheduled, v_has_completed, v_has_unknown
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
    if v_has_completed then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_COMPLETED';
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
