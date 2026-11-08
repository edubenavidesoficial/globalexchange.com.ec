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
    v_parent constant uuid := '4d4b1c01-0000-4000-8000-000000000100';
    v_key constant uuid := '4d4b1c01-0000-4000-8000-000000000001';
    v_actor uuid; v_role text; v_seller uuid; v_program uuid;
    v_date date := (clock_timestamp() AT TIME ZONE 'UTC')::date + 30;
    v_response jsonb; v_replay jsonb; v_expected jsonb;
    v_first jsonb; v_before jsonb; v_after jsonb;
    v_meeting public.meetings%rowtype; v_request public.consultation_requests%rowtype;
    v_old_id uuid; v_error text; v_case text; v_hash text; v_test_key uuid;
    v_expected_error text;
BEGIN

    IF NOT pg_try_advisory_xact_lock(hashtextextended('HARNESS:4d4b1c01',0)) THEN
        RAISE EXCEPTION 'FAIL another copy of this harness is running';
    END IF;
    IF EXISTS(SELECT 1 FROM public.consultation_requests WHERE id=v_parent)
       OR EXISTS(SELECT 1 FROM public.meetings WHERE consultation_request_id=v_parent OR id::text LIKE '4d4b1c01-%')
       OR EXISTS(SELECT 1 FROM public.idempotency_records WHERE consultation_request_id=v_parent OR idempotency_key::text LIKE '4d4b1c01-%')
       OR EXISTS(SELECT 1 FROM public.audit_events WHERE entity_id=v_parent OR entity_id::text LIKE '4d4b1c01-%'
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
      '4d4b1c01@example.invalid','SYNTHETIC','online',v_date,time '12:00',
      'HARNESS:4d4b1c01:ROLLBACK_ONLY');

    -- A: CREATE. Exact JSON comparison includes all existing keys and no context keys.
    v_response := public.create_consultation_meeting(v_actor,v_parent,v_key,'harness:create:A',
      v_date,time '12:00','UTC',45,'online',v_seller,NULL);
    v_first := v_response;
    SELECT * INTO STRICT v_meeting FROM public.meetings WHERE consultation_request_id=v_parent;
    SELECT * INTO STRICT v_request FROM public.consultation_requests WHERE id=v_parent;
    v_old_id := v_meeting.id;
    IF v_meeting.status IS DISTINCT FROM 'scheduled' OR v_meeting.version IS DISTINCT FROM 1
       OR v_meeting.schedule_revision IS DISTINCT FROM 1
       OR v_meeting.booked_by IS DISTINCT FROM v_actor OR v_meeting.role_at_booking IS DISTINCT FROM v_role
       OR v_meeting.booking_attribution_source IS DISTINCT FROM 'explicit'
       OR v_meeting.assigned_to IS DISTINCT FROM v_seller
       OR v_meeting.created_by IS DISTINCT FROM v_actor OR v_meeting.updated_by IS DISTINCT FROM v_actor
       OR v_request.status IS DISTINCT FROM 'converted' THEN
        RAISE EXCEPTION 'FAIL A persisted state / attribution';
    END IF;
    v_expected := jsonb_build_object(
      'consultation',jsonb_build_object('id',v_request.id,'status',v_request.status,'updatedAt',v_request.updated_at),
      'meeting',jsonb_build_object('id',v_meeting.id,'consultationRequestId',v_parent,
        'scheduledAt',v_meeting.scheduled_at,'timeZone',v_meeting.time_zone,
        'durationMinutes',v_meeting.duration_minutes,'mode',v_meeting.mode,'status',v_meeting.status,
        'assignedTo',v_seller,'createdBy',v_actor,'updatedBy',v_actor,'version',v_meeting.version,
        'createdAt',v_meeting.created_at,'updatedAt',v_meeting.updated_at));
    IF v_response IS DISTINCT FROM v_expected THEN RAISE EXCEPTION 'FAIL A exact response'; END IF;
    IF (SELECT count(*) FROM public.audit_events WHERE entity_id IN (v_parent,v_meeting.id))<>2
       OR (SELECT count(*) FROM public.audit_events WHERE entity_id=v_parent AND entity_type='consultation_request'
          AND action='consultation_converted' AND actor_id=v_actor
          AND metadata=jsonb_build_object('meetingId',v_meeting.id))<>1
       OR (SELECT count(*) FROM public.audit_events WHERE entity_id=v_meeting.id AND entity_type='meeting'
          AND action='meeting_created' AND actor_id=v_actor
          AND metadata=jsonb_build_object('consultationRequestId',v_parent))<>1
       OR (SELECT count(DISTINCT operation_id) FROM public.audit_events WHERE entity_id IN (v_parent,v_meeting.id))<>1 THEN
        RAISE EXCEPTION 'FAIL A exact audit / shared operation';
    END IF;
    IF (SELECT count(*) FROM public.idempotency_records WHERE consultation_request_id=v_parent)<>1
       OR NOT EXISTS(SELECT 1 FROM public.idempotency_records WHERE actor_id=v_actor
         AND operation='create_consultation_meeting' AND idempotency_key=v_key
         AND request_hash='harness:create:A' AND consultation_request_id=v_parent AND response_payload=v_response) THEN
        RAISE EXCEPTION 'FAIL A idempotency';
    END IF;
    RAISE NOTICE 'PASS A';
    -- B/C/E: compare every fixture row, including timestamps, audits and stored snapshots.
    FOREACH v_case IN ARRAY ARRAY['B','C','E'] LOOP

    SELECT jsonb_build_object(
      'consultation',(SELECT to_jsonb(c) FROM public.consultation_requests c WHERE id=v_parent),
      'meetings',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM public.meetings m WHERE consultation_request_id=v_parent),
      'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM public.audit_events a
        WHERE entity_id=v_parent OR entity_id IN (SELECT id FROM public.meetings WHERE consultation_request_id=v_parent)),
      'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]'::jsonb) FROM public.idempotency_records i WHERE consultation_request_id=v_parent)
    ) INTO v_before;

        IF v_case='B' THEN
            v_replay := public.create_consultation_meeting(v_actor,v_parent,v_key,'harness:create:A',
              v_date,time '12:00','UTC',45,'online',v_seller,NULL);
            IF v_replay IS DISTINCT FROM v_first THEN RAISE EXCEPTION 'FAIL B replay response'; END IF;
        ELSE
            v_error := NULL;
            v_hash := CASE WHEN v_case='C' THEN 'harness:DIFFERENT' ELSE 'harness:create:E' END;
            v_test_key := CASE WHEN v_case='C' THEN v_key ELSE '4d4b1c01-0000-4000-8000-000000000005'::uuid END;
            BEGIN
                PERFORM public.create_consultation_meeting(v_actor,v_parent,v_test_key,v_hash,
                  v_date,time '12:00','UTC',45,'online',v_seller,NULL);
            EXCEPTION WHEN SQLSTATE 'P0001' THEN
                v_error := SQLERRM;
            END;
            v_expected_error :=
                CASE
                    WHEN v_case='C' THEN 'IDEMPOTENCY_KEY_REUSED'
                    WHEN v_case='E' THEN 'CONSULTATION_ALREADY_SCHEDULED'
                    ELSE NULL
                END;
            IF v_error IS DISTINCT FROM v_expected_error THEN
                RAISE EXCEPTION 'FAIL % wrong/missing expected P0001 error: %',v_case,v_error;
            END IF;
        END IF;

    SELECT jsonb_build_object(
      'consultation',(SELECT to_jsonb(c) FROM public.consultation_requests c WHERE id=v_parent),
      'meetings',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM public.meetings m WHERE consultation_request_id=v_parent),
      'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM public.audit_events a
        WHERE entity_id=v_parent OR entity_id IN (SELECT id FROM public.meetings WHERE consultation_request_id=v_parent)),
      'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]'::jsonb) FROM public.idempotency_records i WHERE consultation_request_id=v_parent)
    ) INTO v_after;

        IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'FAIL % unexpected side effects',v_case; END IF;
        RAISE NOTICE 'PASS %',v_case;
    END LOOP;
    -- D: controlled historical fixture; not an outcome workflow test.
    UPDATE public.meetings SET status='completed',scheduled_at=clock_timestamp()-interval '1 day'
      WHERE id=v_old_id AND consultation_request_id=v_parent;
    IF NOT FOUND THEN RAISE EXCEPTION 'FAIL D missing owned fixture'; END IF;
    v_response := public.create_consultation_meeting(v_actor,v_parent,
      '4d4b1c01-0000-4000-8000-000000000004','harness:create:D',
      v_date+1,time '12:00','UTC',45,'online',v_seller,NULL);
    IF (SELECT count(*) FROM public.meetings WHERE consultation_request_id=v_parent)<>2
       OR (SELECT count(*) FROM public.meetings WHERE consultation_request_id=v_parent AND status='scheduled')<>1
       OR NOT EXISTS(SELECT 1 FROM public.meetings WHERE id=v_old_id AND consultation_request_id=v_parent AND status='completed')
       OR (SELECT count(*) FROM public.audit_events WHERE entity_id=v_parent)<>1
       OR (SELECT count(*) FROM public.audit_events WHERE entity_id IN
          (SELECT id FROM public.meetings WHERE consultation_request_id=v_parent))<>2
       OR (SELECT count(*) FROM public.idempotency_records WHERE consultation_request_id=v_parent)<>2 THEN
        RAISE EXCEPTION 'FAIL D post-completed / audit / idempotency';
    END IF;
    SELECT * INTO STRICT v_meeting FROM public.meetings WHERE consultation_request_id=v_parent AND status='scheduled';
    IF v_meeting.booked_by IS DISTINCT FROM v_actor OR v_meeting.role_at_booking IS DISTINCT FROM v_role
       OR v_meeting.booking_attribution_source IS DISTINCT FROM 'explicit'
       OR v_meeting.version<>1 OR v_meeting.schedule_revision<>1
       OR (v_response->'meeting'->>'id')::uuid IS DISTINCT FROM v_meeting.id THEN
        RAISE EXCEPTION 'FAIL D new meeting attribution';
    END IF;
    RAISE NOTICE 'PASS D';
    -- B again after the original meeting became completed: historical snapshot must win.

    SELECT jsonb_build_object(
      'consultation',(SELECT to_jsonb(c) FROM public.consultation_requests c WHERE id=v_parent),
      'meetings',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM public.meetings m WHERE consultation_request_id=v_parent),
      'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM public.audit_events a
        WHERE entity_id=v_parent OR entity_id IN (SELECT id FROM public.meetings WHERE consultation_request_id=v_parent)),
      'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]'::jsonb) FROM public.idempotency_records i WHERE consultation_request_id=v_parent)
    ) INTO v_before;

    v_replay := public.create_consultation_meeting(v_actor,v_parent,v_key,'harness:create:A',
      v_date,time '12:00','UTC',45,'online',v_seller,NULL);

    SELECT jsonb_build_object(
      'consultation',(SELECT to_jsonb(c) FROM public.consultation_requests c WHERE id=v_parent),
      'meetings',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM public.meetings m WHERE consultation_request_id=v_parent),
      'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM public.audit_events a
        WHERE entity_id=v_parent OR entity_id IN (SELECT id FROM public.meetings WHERE consultation_request_id=v_parent)),
      'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]'::jsonb) FROM public.idempotency_records i WHERE consultation_request_id=v_parent)
    ) INTO v_after;

    IF v_replay IS DISTINCT FROM v_first OR v_before IS DISTINCT FROM v_after THEN
        RAISE EXCEPTION 'FAIL B replay after changed state';
    END IF;
    RAISE NOTICE 'PASS B historical precedence';
END;

$harness$;
\set harness_failed :ERROR
-- Save generated UUIDs in the client, so they survive ROLLBACK.
-- On a failed DO all its writes already rolled back as a subtransaction.
SELECT coalesce(array_agg(id),'{}'::uuid[])::text AS h_meeting_ids
FROM public.meetings WHERE consultation_request_id='4d4b1c01-0000-4000-8000-000000000100'::uuid \gset
SELECT coalesce(array_agg(id),'{}'::uuid[])::text AS h_audit_ids
FROM public.audit_events
WHERE entity_id='4d4b1c01-0000-4000-8000-000000000100'::uuid OR entity_id=ANY(:'h_meeting_ids'::uuid[])
   OR metadata->>'consultationRequestId'='4d4b1c01-0000-4000-8000-000000000100' \gset
SELECT coalesce(array_agg(id),'{}'::uuid[])::text AS h_idemp_ids
FROM public.idempotency_records
WHERE consultation_request_id='4d4b1c01-0000-4000-8000-000000000100'::uuid \gset
\set manifest_failed :ERROR
ROLLBACK;
\set ON_ERROR_STOP on
SELECT
 (SELECT count(*) FROM public.consultation_requests WHERE id='4d4b1c01-0000-4000-8000-000000000100'::uuid) AS residue_consultations,
 (SELECT count(*) FROM public.meetings WHERE consultation_request_id='4d4b1c01-0000-4000-8000-000000000100'::uuid
     OR id=ANY(:'h_meeting_ids'::uuid[])) AS residue_meetings,
 (SELECT count(*) FROM public.audit_events WHERE id=ANY(:'h_audit_ids'::uuid[])
     OR entity_id='4d4b1c01-0000-4000-8000-000000000100'::uuid OR entity_id=ANY(:'h_meeting_ids'::uuid[])
     OR metadata->>'consultationRequestId'='4d4b1c01-0000-4000-8000-000000000100') AS residue_audit,
 (SELECT count(*) FROM public.idempotency_records WHERE consultation_request_id='4d4b1c01-0000-4000-8000-000000000100'::uuid
     OR id=ANY(:'h_idemp_ids'::uuid[]) OR idempotency_key::text LIKE '4d4b1c01-%') AS residue_idempotency
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
