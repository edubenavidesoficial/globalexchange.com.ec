-- DESIGN ONLY: not executed. psql only; use a dedicated connection with autocommit.
-- Never paste fragments or run through a connection pool / Supabase db query.
\set AUTOCOMMIT on
\set ON_ERROR_ROLLBACK off
\set ON_ERROR_STOP on
\if :{?RUN_4D4B1C}
\else
  \echo 'REFUSED: supply -v RUN_4D4B1C=on only after manual approval'
  \quit
\endif
\if :RUN_4D4B1C
\else
  \quit
\endif
\set h_meeting_ids '{}'
\set h_audit_ids '{}'
\set h_idemp_ids '{}'
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '90s';
-- Continue ONLY so that a failed DO is followed by ROLLBACK. Save its status.
\set ON_ERROR_STOP off

DO $harness$
DECLARE
    v_parent constant uuid := '4d4b1c02-0000-4000-8000-000000000100';
    v_id constant uuid := '4d4b1c02-0000-4000-8000-000000000200';
    v_actor uuid; v_role text; v_seller uuid; v_program uuid;
    v_date date := (clock_timestamp() AT TIME ZONE 'UTC')::date + 30;
    v_new_date date; v_zone text; v_duration integer; v_mode text;
    v_key uuid; v_hash text; v_expected_version integer;
    v_expected_revision integer;
    v_case text; v_index integer := 0; v_changed boolean;
    v_expected_error text; v_error text; v_result jsonb; v_first jsonb;
    v_expected jsonb; v_before jsonb; v_after jsonb;
    v_old public.meetings%rowtype; v_new public.meetings%rowtype;
    v_audit_ids uuid[]; v_idemp_ids uuid[];
BEGIN

    IF NOT pg_try_advisory_xact_lock(hashtextextended('HARNESS:4d4b1c02',0)) THEN
        RAISE EXCEPTION 'FAIL another copy of this harness is running';
    END IF;
    IF EXISTS(SELECT 1 FROM public.consultation_requests WHERE id=v_parent)
       OR EXISTS(SELECT 1 FROM public.meetings WHERE consultation_request_id=v_parent OR id::text LIKE '4d4b1c02-%')
       OR EXISTS(SELECT 1 FROM public.idempotency_records WHERE consultation_request_id=v_parent OR idempotency_key::text LIKE '4d4b1c02-%')
       OR EXISTS(SELECT 1 FROM public.audit_events WHERE entity_id=v_parent OR entity_id::text LIKE '4d4b1c02-%'
                 OR metadata->>'consultationRequestId'=v_parent::text) THEN
        RAISE EXCEPTION 'FAIL fixture namespace already occupied; no overwrite/cleanup permitted';
    END IF;
    -- Reference existing rows only. SHARE freezes eligibility during this short test.
    SELECT id,role INTO v_actor,v_role FROM public.internal_users
      WHERE active AND role='admin' ORDER BY id LIMIT 1 FOR SHARE;
    SELECT id INTO v_seller FROM public.internal_users
      WHERE active AND role='vendedora' ORDER BY id LIMIT 1 FOR SHARE;
    SELECT id INTO v_program FROM public.programs
      WHERE active ORDER BY id LIMIT 1 FOR SHARE;
    IF v_actor IS NULL OR v_seller IS NULL OR v_program IS NULL THEN
        RAISE EXCEPTION 'FAIL missing active admin/seller/program; never modify users to compensate';
    END IF;
    IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN
        ('public.consultation_requests'::regclass,'public.meetings'::regclass,
         'public.audit_events'::regclass,'public.idempotency_records'::regclass))
       OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class IN
        ('public.consultation_requests'::regclass,'public.meetings'::regclass,
         'public.audit_events'::regclass,'public.idempotency_records'::regclass)) THEN
        RAISE EXCEPTION 'FAIL triggers/rules changed since review; re-audit before running';
    END IF;
    INSERT INTO public.consultation_requests
      (id,program_id,full_name,phone,email,city,mode,preferred_date,preferred_time,message)
    VALUES (v_parent,v_program,'SYNTHETIC 4D.4B.1C','0000000000',
      '4d4b1c02@example.invalid','SYNTHETIC','online',v_date,time '12:00',
      'HARNESS:4d4b1c02:ROLLBACK_ONLY');

    IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name='Etc/UTC') THEN
        RAISE EXCEPTION 'FAIL missing Etc/UTC for textual zone test';
    END IF;
    UPDATE public.consultation_requests SET status='converted' WHERE id=v_parent;
    INSERT INTO public.meetings
      (id,consultation_request_id,scheduled_at,time_zone,duration_minutes,mode,status,
       notes,assigned_to,created_by,updated_by,version,
       booked_by,role_at_booking,booking_attribution_source,schedule_revision)
    VALUES (v_id,v_parent,(v_date+time '12:00') AT TIME ZONE 'UTC','UTC',45,'online','scheduled',
      'SYNTHETIC 4D.4B.1C',v_seller,v_actor,v_actor,7,v_actor,v_role,'explicit',3);
    FOREACH v_case IN ARRAY ARRAY['F_DATE','F_ZONE','F_DURATION','F_MODE','G','H','I','J','K','L','M','N','O'] LOOP
        v_index := v_index+1;
        v_key := ('4d4b1c02-0000-4000-8000-'||lpad(v_index::text,12,'0'))::uuid;
        v_hash := 'harness:reschedule:'||v_case;
        -- Reset only our synthetic row, never a client meeting.
        UPDATE public.meetings SET
          scheduled_at=(v_date+time '12:00') AT TIME ZONE 'UTC',time_zone='UTC',
          duration_minutes=45,mode='online',status='scheduled',version=7,schedule_revision=3,
          booked_by=v_actor,role_at_booking=v_role,booking_attribution_source='explicit'
          WHERE id=v_id AND consultation_request_id=v_parent;
        IF NOT FOUND THEN RAISE EXCEPTION 'FAIL missing owned fixture'; END IF;
        IF v_case IN ('K','L') THEN
            UPDATE public.meetings SET schedule_revision=2147483647 WHERE id=v_id AND consultation_request_id=v_parent;
        ELSIF v_case='M' THEN
            UPDATE public.meetings SET version=2147483647 WHERE id=v_id AND consultation_request_id=v_parent;
        ELSIF v_case='N' THEN
            UPDATE public.meetings SET booking_attribution_source='administrative_correction'
              WHERE id=v_id AND consultation_request_id=v_parent;
        ELSIF v_case='O' THEN
            UPDATE public.meetings SET booked_by=NULL,role_at_booking=NULL,booking_attribution_source='unknown'
              WHERE id=v_id AND consultation_request_id=v_parent;
        END IF;
        SELECT * INTO STRICT v_old FROM public.meetings WHERE id=v_id AND consultation_request_id=v_parent;
        v_new_date := v_date; v_zone := 'UTC'; v_duration := 45; v_mode := 'online';
        IF v_case IN ('F_DATE','H','I','J','L','N','O') THEN v_new_date := v_date+1; END IF;
        IF v_case='F_ZONE' THEN v_zone := 'Etc/UTC'; END IF;
        IF v_case='F_DURATION' THEN v_duration := 60; END IF;
        IF v_case='F_MODE' THEN v_mode := 'phone'; END IF;
        v_changed := v_case NOT IN ('G','K','M');
        v_expected_version := CASE WHEN v_case='J' THEN 6 ELSE v_old.version END;
        v_expected_error := CASE WHEN v_case='J' THEN 'MEETING_VERSION_CONFLICT'
            WHEN v_case IN ('L','M') THEN 'INTERNAL_ERROR' ELSE NULL END;
        SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO v_audit_ids FROM public.audit_events
          WHERE entity_id=v_id OR entity_id=v_parent;
        SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO v_idemp_ids FROM public.idempotency_records
          WHERE consultation_request_id=v_parent;

    SELECT jsonb_build_object(
      'consultation',(SELECT to_jsonb(c) FROM public.consultation_requests c WHERE id=v_parent),
      'meetings',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM public.meetings m WHERE consultation_request_id=v_parent),
      'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM public.audit_events a
        WHERE entity_id=v_parent OR entity_id IN (SELECT id FROM public.meetings WHERE consultation_request_id=v_parent)),
      'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]'::jsonb) FROM public.idempotency_records i WHERE consultation_request_id=v_parent)
    ) INTO v_before;

        v_error := NULL;
        BEGIN
            v_result := public.reschedule_consultation_meeting(v_actor,v_id,v_key,v_hash,
              v_expected_version,v_new_date,time '12:00',v_zone,v_duration,v_mode);
        EXCEPTION WHEN SQLSTATE 'P0001' THEN
            v_error := SQLERRM;
        END;
        IF v_error IS DISTINCT FROM v_expected_error THEN
            RAISE EXCEPTION 'FAIL % unexpected/missing P0001: expected %, got %',v_case,v_expected_error,v_error;
        END IF;
        IF v_expected_error IS NOT NULL THEN

    SELECT jsonb_build_object(
      'consultation',(SELECT to_jsonb(c) FROM public.consultation_requests c WHERE id=v_parent),
      'meetings',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM public.meetings m WHERE consultation_request_id=v_parent),
      'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM public.audit_events a
        WHERE entity_id=v_parent OR entity_id IN (SELECT id FROM public.meetings WHERE consultation_request_id=v_parent)),
      'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]'::jsonb) FROM public.idempotency_records i WHERE consultation_request_id=v_parent)
    ) INTO v_after;

            IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'FAIL % error left effects',v_case; END IF;
        ELSE
            SELECT * INTO STRICT v_new FROM public.meetings WHERE id=v_id AND consultation_request_id=v_parent;
            v_expected_revision :=
                CASE
                    WHEN v_changed THEN v_old.schedule_revision+1
                    ELSE v_old.schedule_revision
                END;
            IF v_new.version IS DISTINCT FROM v_old.version+1
               OR v_new.schedule_revision IS DISTINCT FROM v_expected_revision
               OR ROW(v_new.booked_by,v_new.role_at_booking,v_new.booking_attribution_source)
                  IS DISTINCT FROM ROW(v_old.booked_by,v_old.role_at_booking,v_old.booking_attribution_source)
               OR ROW(v_new.assigned_to,v_new.notes,v_new.created_by,v_new.created_at)
                  IS DISTINCT FROM ROW(v_old.assigned_to,v_old.notes,v_old.created_by,v_old.created_at)
               OR v_new.updated_by IS DISTINCT FROM v_actor
               OR v_new.updated_at IS NULL OR v_new.updated_at < v_old.updated_at
               OR v_new.scheduled_at IS DISTINCT FROM ((v_new_date+time '12:00') AT TIME ZONE v_zone)
               OR v_new.time_zone IS DISTINCT FROM v_zone OR v_new.duration_minutes IS DISTINCT FROM v_duration
               OR v_new.mode IS DISTINCT FROM v_mode OR v_new.status IS DISTINCT FROM 'scheduled' THEN
                RAISE EXCEPTION 'FAIL % persisted values / option B / attribution',v_case;
            END IF;
            v_expected := jsonb_build_object('id',v_id,'consultationRequestId',v_parent,
              'scheduledAt',v_new.scheduled_at,'timeZone',v_new.time_zone,'durationMinutes',v_new.duration_minutes,
              'mode',v_new.mode,'status',v_new.status,'version',v_new.version);
            IF v_result IS DISTINCT FROM v_expected THEN RAISE EXCEPTION 'FAIL % exact eight-field response',v_case; END IF;
            IF (SELECT count(*) FROM public.audit_events WHERE (entity_id=v_id OR entity_id=v_parent)
                  AND NOT(id=ANY(v_audit_ids)))<>1
               OR NOT EXISTS(SELECT 1 FROM public.audit_events WHERE entity_id=v_id AND NOT(id=ANY(v_audit_ids))
                  AND actor_id=v_actor AND entity_type='meeting' AND action='meeting_rescheduled'
                  AND metadata=jsonb_build_object(
                    'oldScheduledAt',v_old.scheduled_at,'newScheduledAt',v_new.scheduled_at,
                    'oldTimeZone',v_old.time_zone,'newTimeZone',v_new.time_zone,
                    'oldDurationMinutes',v_old.duration_minutes,'newDurationMinutes',v_new.duration_minutes,
                    'oldMode',v_old.mode,'newMode',v_new.mode,
                    'previousVersion',v_old.version,'newVersion',v_new.version)) THEN
                RAISE EXCEPTION 'FAIL % exact audit delta/metadata',v_case;
            END IF;
            IF (SELECT count(*) FROM public.idempotency_records WHERE consultation_request_id=v_parent
                  AND NOT(id=ANY(v_idemp_ids)))<>1
               OR NOT EXISTS(SELECT 1 FROM public.idempotency_records WHERE actor_id=v_actor
                  AND operation='reschedule_consultation_meeting' AND idempotency_key=v_key AND request_hash=v_hash
                  AND consultation_request_id=v_parent AND response_payload=v_result) THEN
                RAISE EXCEPTION 'FAIL % exact idempotency delta/snapshot',v_case;
            END IF;
            -- No unexpected parent mutation on successful reschedule.
            IF (SELECT to_jsonb(c) FROM public.consultation_requests c WHERE id=v_parent)
                IS DISTINCT FROM v_before->'consultation' THEN
                RAISE EXCEPTION 'FAIL % changed parent',v_case;
            END IF;
        END IF;
        IF v_case IN ('H','I') THEN
            v_first := v_result;
            IF v_case='H' THEN
                -- Replay must precede current status, CAS and both overflows.
                UPDATE public.meetings SET status='cancelled',version=2147483647,schedule_revision=2147483647
                  WHERE id=v_id AND consultation_request_id=v_parent;
            END IF;

    SELECT jsonb_build_object(
      'consultation',(SELECT to_jsonb(c) FROM public.consultation_requests c WHERE id=v_parent),
      'meetings',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM public.meetings m WHERE consultation_request_id=v_parent),
      'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM public.audit_events a
        WHERE entity_id=v_parent OR entity_id IN (SELECT id FROM public.meetings WHERE consultation_request_id=v_parent)),
      'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]'::jsonb) FROM public.idempotency_records i WHERE consultation_request_id=v_parent)
    ) INTO v_before;

            v_error := NULL;
            BEGIN
                v_result := public.reschedule_consultation_meeting(v_actor,v_id,v_key,
                  CASE WHEN v_case='I' THEN v_hash||':DIFFERENT' ELSE v_hash END,
                  v_expected_version,v_new_date,time '12:00',v_zone,v_duration,v_mode);
            EXCEPTION WHEN SQLSTATE 'P0001' THEN v_error := SQLERRM;
            END;
            IF (v_case='I' AND v_error IS DISTINCT FROM 'IDEMPOTENCY_KEY_REUSED')
               OR (v_case='H' AND (v_error IS NOT NULL OR v_result IS DISTINCT FROM v_first)) THEN
                RAISE EXCEPTION 'FAIL % replay/hash precedence',v_case;
            END IF;

    SELECT jsonb_build_object(
      'consultation',(SELECT to_jsonb(c) FROM public.consultation_requests c WHERE id=v_parent),
      'meetings',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM public.meetings m WHERE consultation_request_id=v_parent),
      'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM public.audit_events a
        WHERE entity_id=v_parent OR entity_id IN (SELECT id FROM public.meetings WHERE consultation_request_id=v_parent)),
      'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]'::jsonb) FROM public.idempotency_records i WHERE consultation_request_id=v_parent)
    ) INTO v_after;

            IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'FAIL % replay/error side effects',v_case; END IF;
        END IF;
        RAISE NOTICE 'PASS %',v_case;
    END LOOP;
END;

$harness$;
\set harness_failed :ERROR
-- Save generated UUIDs in the client, so they survive ROLLBACK.
-- On a failed DO all its writes already rolled back as a subtransaction.
SELECT coalesce(array_agg(id),'{}'::uuid[])::text AS h_meeting_ids
FROM public.meetings WHERE consultation_request_id='4d4b1c02-0000-4000-8000-000000000100'::uuid \gset
SELECT coalesce(array_agg(id),'{}'::uuid[])::text AS h_audit_ids
FROM public.audit_events
WHERE entity_id='4d4b1c02-0000-4000-8000-000000000100'::uuid OR entity_id=ANY(:'h_meeting_ids'::uuid[])
   OR metadata->>'consultationRequestId'='4d4b1c02-0000-4000-8000-000000000100' \gset
SELECT coalesce(array_agg(id),'{}'::uuid[])::text AS h_idemp_ids
FROM public.idempotency_records
WHERE consultation_request_id='4d4b1c02-0000-4000-8000-000000000100'::uuid \gset
\set manifest_failed :ERROR
ROLLBACK;
\set ON_ERROR_STOP on
SELECT
 (SELECT count(*) FROM public.consultation_requests WHERE id='4d4b1c02-0000-4000-8000-000000000100'::uuid) AS residue_consultations,
 (SELECT count(*) FROM public.meetings WHERE consultation_request_id='4d4b1c02-0000-4000-8000-000000000100'::uuid
     OR id=ANY(:'h_meeting_ids'::uuid[])) AS residue_meetings,
 (SELECT count(*) FROM public.audit_events WHERE id=ANY(:'h_audit_ids'::uuid[])
     OR entity_id='4d4b1c02-0000-4000-8000-000000000100'::uuid OR entity_id=ANY(:'h_meeting_ids'::uuid[])
     OR metadata->>'consultationRequestId'='4d4b1c02-0000-4000-8000-000000000100') AS residue_audit,
 (SELECT count(*) FROM public.idempotency_records WHERE consultation_request_id='4d4b1c02-0000-4000-8000-000000000100'::uuid
     OR id=ANY(:'h_idemp_ids'::uuid[]) OR idempotency_key::text LIKE '4d4b1c02-%') AS residue_idempotency
\gset
SELECT (:residue_consultations + :residue_meetings + :residue_audit + :residue_idempotency)=0 AS residue_zero \gset
\echo 'Residue consultation/meeting/audit/idempotency:' :residue_consultations :residue_meetings :residue_audit :residue_idempotency
\if :harness_failed
  \echo 'FAIL: assertions/preconditions failed; ROLLBACK issued. Review the first SQL error.'
  \set ON_ERROR_STOP on
  DO $failure$ BEGIN RAISE EXCEPTION 'FAIL harness stopped; inspect earlier error and residue'; END; $failure$;
\endif
\if :manifest_failed
  \echo 'FAIL: could not capture the residue manifest; ROLLBACK issued.'
  \set ON_ERROR_STOP on
  DO $failure$ BEGIN RAISE EXCEPTION 'FAIL harness stopped; inspect earlier error and residue'; END; $failure$;
\endif
\if :residue_zero
  \echo 'PASS group and residue=0; no COMMIT was executed'
\else
  \echo 'FAIL residue; do not delete anything automatically'
  \set ON_ERROR_STOP on
  DO $failure$ BEGIN RAISE EXCEPTION 'FAIL harness stopped; inspect earlier error and residue'; END; $failure$;
\endif
