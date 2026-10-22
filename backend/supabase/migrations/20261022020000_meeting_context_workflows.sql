BEGIN;

-- Exact ECMAScript WhiteSpace + LineTerminator set; no locale regex or normalization.
create function public.canonicalize_meeting_notes(p_value text)
returns text
language sql
immutable
strict
parallel safe
security invoker
set search_path = pg_catalog, pg_temp
as $$
    select nullif(pg_catalog.btrim(p_value,
        U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    ), '');
$$;

revoke all privileges on function public.canonicalize_meeting_notes(text)
    from public, anon, authenticated, service_role;
grant execute on function public.canonicalize_meeting_notes(text) to service_role;

alter table public.audit_events drop constraint audit_events_entity_action_valid;
alter table public.audit_events add constraint audit_events_entity_action_valid check (
    (entity_type = 'consultation_request' and action = 'consultation_converted')
    or (entity_type = 'meeting' and action in (
        'meeting_created', 'meeting_rescheduled', 'meeting_cancelled',
        'meeting_completed', 'meeting_no_show', 'meeting_notes_updated',
        'meeting_booking_attribution_corrected'))
);

alter table public.idempotency_records drop constraint idempotency_records_operation_valid;
alter table public.idempotency_records add constraint idempotency_records_operation_valid check (
    operation in ('create_consultation_meeting', 'reschedule_consultation_meeting',
        'cancel_consultation_meeting', 'complete_consultation_meeting',
        'mark_consultation_meeting_no_show', 'correct_meeting_booking_attribution')
);

create function public.update_meeting_notes(
    p_actor_id uuid,
    p_meeting_id uuid,
    p_expected_version integer,
    p_notes text,
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
    v_actor public.internal_users%rowtype;
    v_request public.consultation_requests%rowtype;
    v_old public.meetings%rowtype;
    v_meeting public.meetings%rowtype;
    v_parent_id uuid;
    v_notes text;
    v_terminal boolean;
    v_changed boolean;
begin
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = 'P0001', message = 'WORKFLOW_ISOLATION_NOT_SUPPORTED';
    end if;
    if p_actor_id is null then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;
    if p_meeting_id is null then
        raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
    end if;
    if p_expected_version is null or p_expected_version <= 0 then
        raise exception using errcode = 'P0001', message = 'INVALID_MEETING_INPUT';
    end if;
    v_notes := public.canonicalize_meeting_notes(p_notes);
    if public.utf16_length(v_notes) > 2000 then
        raise exception using errcode = 'P0001', message = 'INVALID_MEETING_NOTES';
    end if;

    select u.* into v_actor from public.internal_users u
        where u.id = p_actor_id for share;
    if not found or v_actor.active is distinct from true
        or v_actor.role not in ('admin', 'agendadora') then
        raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
    end if;

    -- Discovery does not authorize a write; lock parent before meeting.
    select m.consultation_request_id into v_parent_id from public.meetings m
        where m.id = p_meeting_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    select r.* into v_request from public.consultation_requests r
        where r.id = v_parent_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    select m.* into v_old from public.meetings m
        where m.id = p_meeting_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    if v_old.id is distinct from p_meeting_id
        or v_old.consultation_request_id is distinct from v_parent_id
        or v_request.status is distinct from 'converted' then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    if v_old.status = 'scheduled' then
        v_terminal := false;
        if p_reason is not null then
            raise exception using errcode = 'P0001', message = 'INVALID_CORRECTION_REASON';
        end if;
    elsif v_old.status in ('completed', 'cancelled', 'no_show') then
        v_terminal := true;
        if v_actor.role is distinct from 'admin' then
            raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED';
        end if;
        if p_reason is null or p_reason not in ('clerical_error', 'operational_clarification') then
            raise exception using errcode = 'P0001', message = 'INVALID_CORRECTION_REASON';
        end if;
    else
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    if v_old.version is distinct from p_expected_version then
        raise exception using errcode = 'P0001', message = 'MEETING_VERSION_CONFLICT';
    end if;

    -- CAS and authorization precede no-op; INT_MAX is valid when nothing changes.
    v_changed := v_old.notes is distinct from v_notes;
    v_meeting := v_old;
    if v_changed then
        if v_old.version = 2147483647 then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end if;
        update public.meetings set
            notes = v_notes, updated_by = p_actor_id,
            updated_at = clock_timestamp(), version = version + 1
            where id = v_old.id returning * into v_meeting;
        if not found then
            raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
        end if;
        insert into public.audit_events (actor_id, entity_type, entity_id, action, metadata, operation_id)
            values (p_actor_id, 'meeting', v_meeting.id, 'meeting_notes_updated', jsonb_build_object(
                'previousVersion', v_old.version, 'newVersion', v_meeting.version,
                'notePresentBefore', v_old.notes is not null,
                'notePresentAfter', v_meeting.notes is not null,
                'terminalCorrection', v_terminal, 'reason', p_reason
            ), gen_random_uuid());
    end if;

    return jsonb_build_object(
        'id', v_meeting.id, 'consultationRequestId', v_meeting.consultation_request_id,
        'notes', v_meeting.notes, 'version', v_meeting.version,
        'scheduleRevision', v_meeting.schedule_revision,
        'updatedAt', v_meeting.updated_at, 'changed', v_changed
    );
end;
$$;

revoke all privileges on function public.update_meeting_notes(uuid, uuid, integer, text, text)
    from public, anon, authenticated, service_role;
grant execute on function public.update_meeting_notes(uuid, uuid, integer, text, text) to service_role;

create function public.correct_meeting_booking_attribution(
    p_actor_id uuid,
    p_meeting_id uuid,
    p_idempotency_key uuid,
    p_request_hash text,
    p_expected_version integer,
    p_booked_by uuid,
    p_role_at_booking text,
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
    v_operation constant text := 'correct_meeting_booking_attribution';
    v_actor public.internal_users%rowtype;
    v_target public.internal_users%rowtype;
    v_previous public.idempotency_records%rowtype;
    v_request public.consultation_requests%rowtype;
    v_old public.meetings%rowtype;
    v_meeting public.meetings%rowtype;
    v_parent_id uuid;
    v_response jsonb;
    v_changed boolean;
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
    if p_expected_version is null or p_expected_version <= 0 then
        raise exception using errcode = 'P0001', message = 'INVALID_MEETING_INPUT';
    end if;
    if p_booked_by is null then
        raise exception using errcode = 'P0001', message = 'BOOKING_ATTRIBUTION_TARGET_NOT_ELIGIBLE';
    end if;
    if p_role_at_booking is null or p_role_at_booking not in ('admin', 'agendadora') then
        raise exception using errcode = 'P0001', message = 'BOOKING_ATTRIBUTION_ROLE_MISMATCH';
    end if;
    if p_reason is null or p_reason not in ('wrong_person', 'missing_attribution', 'verified_information') then
        raise exception using errcode = 'P0001', message = 'INVALID_CORRECTION_REASON';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
        v_operation || ':' || p_actor_id::text || ':' || p_idempotency_key::text, 0
    ));
    select u.* into v_actor from public.internal_users u
        where u.id = p_actor_id for share;
    if not found or v_actor.active is distinct from true
        or v_actor.role is distinct from 'admin' then
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
        -- Validate only the persisted snapshot; never read current target/meeting on replay.
        if jsonb_typeof(v_response) is distinct from 'object'
            or not (v_response ?& array['id', 'consultationRequestId', 'bookedBy',
                'roleAtBooking', 'bookingAttributionSource', 'version', 'scheduleRevision', 'updatedAt', 'changed'])
            or (v_response - array['id', 'consultationRequestId', 'bookedBy',
                'roleAtBooking', 'bookingAttributionSource', 'version', 'scheduleRevision', 'updatedAt', 'changed']) <> '{}'::jsonb
            or jsonb_typeof(v_response->'id') is distinct from 'string'
            or jsonb_typeof(v_response->'consultationRequestId') is distinct from 'string'
            or jsonb_typeof(v_response->'bookedBy') is distinct from 'string'
            or jsonb_typeof(v_response->'roleAtBooking') is distinct from 'string'
            or jsonb_typeof(v_response->'bookingAttributionSource') is distinct from 'string'
            or jsonb_typeof(v_response->'version') is distinct from 'number'
            or jsonb_typeof(v_response->'scheduleRevision') is distinct from 'number'
            or jsonb_typeof(v_response->'updatedAt') is distinct from 'string'
            or jsonb_typeof(v_response->'changed') is distinct from 'boolean'
            or coalesce(v_response->>'roleAtBooking', '') not in ('admin', 'agendadora')
            or (v_response->>'bookingAttributionSource') is distinct from 'administrative_correction' then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end if;
        if (v_response->>'updatedAt') !~ '^[0-9]{4,}-[0-9]{2}-[0-9]{2}T' then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end if;
        begin
            if (v_response->>'consultationRequestId')::uuid is distinct from v_previous.consultation_request_id
                or not isfinite((v_response->>'updatedAt')::timestamptz)
                or (v_response->>'version')::integer <= 0
                or (v_response->>'scheduleRevision')::integer <= 0
                or ((v_response->>'changed')::boolean and (v_response->>'version')::integer < 2) then
                raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
            end if;
            perform (v_response->>'bookedBy')::uuid;
            if (v_response->>'id')::uuid is distinct from p_meeting_id then
                raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED';
            end if;
        exception when invalid_text_representation or numeric_value_out_of_range
            or invalid_datetime_format or datetime_field_overflow
            or invalid_time_zone_displacement_value or invalid_parameter_value
            or config_file_error then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end;
        return v_response;
    end if;

    -- New command only: target eligibility is mutable and must not gate replay.
    select u.* into v_target from public.internal_users u
        where u.id = p_booked_by for share;
    if not found or v_target.active is distinct from true
        or v_target.role not in ('admin', 'agendadora') then
        raise exception using errcode = 'P0001', message = 'BOOKING_ATTRIBUTION_TARGET_NOT_ELIGIBLE';
    end if;
    if v_target.role is distinct from p_role_at_booking then
        raise exception using errcode = 'P0001', message = 'BOOKING_ATTRIBUTION_ROLE_MISMATCH';
    end if;

    -- Discovery does not authorize a write; lock parent before meeting.
    select m.consultation_request_id into v_parent_id from public.meetings m
        where m.id = p_meeting_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    select r.* into v_request from public.consultation_requests r
        where r.id = v_parent_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    select m.* into v_old from public.meetings m
        where m.id = p_meeting_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
    end if;
    if v_old.id is distinct from p_meeting_id
        or v_old.consultation_request_id is distinct from v_parent_id
        or v_request.status is distinct from 'converted' then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    if v_old.status is null or v_old.status not in ('scheduled', 'completed', 'cancelled', 'no_show') then
        raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT';
    end if;
    if v_old.version is distinct from p_expected_version then
        raise exception using errcode = 'P0001', message = 'MEETING_VERSION_CONFLICT';
    end if;

    -- Source participates in equality: explicit -> administrative_correction is a change.
    v_changed := v_old.booked_by is distinct from p_booked_by
        or v_old.role_at_booking is distinct from p_role_at_booking
        or v_old.booking_attribution_source is distinct from 'administrative_correction';
    v_meeting := v_old;
    if v_changed then
        if v_old.version = 2147483647 then
            raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
        end if;
        update public.meetings set
            booked_by = p_booked_by, role_at_booking = p_role_at_booking,
            booking_attribution_source = 'administrative_correction',
            updated_by = p_actor_id, updated_at = clock_timestamp(), version = version + 1
            where id = v_old.id returning * into v_meeting;
        if not found then
            raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND';
        end if;
        insert into public.audit_events (actor_id, entity_type, entity_id, action, metadata, operation_id)
            values (p_actor_id, 'meeting', v_meeting.id, 'meeting_booking_attribution_corrected', jsonb_build_object(
                'previousBookedBy', v_old.booked_by, 'newBookedBy', v_meeting.booked_by,
                'previousRoleAtBooking', v_old.role_at_booking, 'newRoleAtBooking', v_meeting.role_at_booking,
                'previousSource', v_old.booking_attribution_source, 'newSource', v_meeting.booking_attribution_source,
                'previousVersion', v_old.version, 'newVersion', v_meeting.version,
                'reason', p_reason
            ), gen_random_uuid());
    end if;

    v_response := jsonb_build_object(
        'id', v_meeting.id, 'consultationRequestId', v_meeting.consultation_request_id,
        'bookedBy', v_meeting.booked_by, 'roleAtBooking', v_meeting.role_at_booking,
        'bookingAttributionSource', v_meeting.booking_attribution_source,
        'version', v_meeting.version, 'scheduleRevision', v_meeting.schedule_revision,
        'updatedAt', v_meeting.updated_at, 'changed', v_changed
    );
    -- Persist both changes and no-ops, atomically with any update and audit.
    insert into public.idempotency_records (
        actor_id, operation, idempotency_key, request_hash, consultation_request_id, response_payload
    ) values (
        p_actor_id, v_operation, p_idempotency_key, p_request_hash, v_parent_id, v_response
    );
    return v_response;
end;
$$;

revoke all privileges on function public.correct_meeting_booking_attribution(uuid, uuid, uuid, text, integer, uuid, text, text)
    from public, anon, authenticated, service_role;
grant execute on function public.correct_meeting_booking_attribution(uuid, uuid, uuid, text, integer, uuid, text, text) to service_role;

COMMIT;
