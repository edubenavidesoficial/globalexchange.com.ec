-- DESIGN ONLY: persistent concurrency fixture; always run 06_cleanup afterwards.
\set AUTOCOMMIT on
\set ON_ERROR_ROLLBACK off
\set ON_ERROR_STOP on
\if :{?RUN_4D4B1C}
\else
  \echo 'REFUSED: explicit manual approval RUN_4D4B1C=on required'
  \quit
\endif
\if :RUN_4D4B1C
\else
  \quit
\endif

\if :{?SCENARIO}
\else
  \echo 'REFUSED: SCENARIO=C1/C2/C3_NOTES/C3_ATTRIBUTION/C4 required'
  \quit
\endif
SELECT :'SCENARIO' IN ('C1','C2','C3_NOTES','C3_ATTRIBUTION','C4') AS valid_scenario \gset
\if :valid_scenario
\else
  \quit
\endif
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL idle_in_transaction_session_timeout='90s';
SELECT set_config('harness.scenario', :'SCENARIO', true);
\set ON_ERROR_STOP off

DO $harness$
DECLARE
    v_parent constant uuid := '4d4b1c03-0000-4000-8000-000000000100';
    v_actor uuid; v_role text; v_seller uuid; v_program uuid;
    v_date date := (clock_timestamp() AT TIME ZONE 'UTC')::date+30;
    v_case text := current_setting('harness.scenario');
BEGIN

    IF NOT pg_try_advisory_xact_lock(hashtextextended('HARNESS:4d4b1c03',0)) THEN
        RAISE EXCEPTION 'FAIL another copy of this harness is running';
    END IF;
    IF EXISTS(SELECT 1 FROM public.consultation_requests WHERE id=v_parent)
       OR EXISTS(SELECT 1 FROM public.meetings WHERE consultation_request_id=v_parent OR id::text LIKE '4d4b1c03-%')
       OR EXISTS(SELECT 1 FROM public.idempotency_records WHERE consultation_request_id=v_parent OR idempotency_key::text LIKE '4d4b1c03-%')
       OR EXISTS(SELECT 1 FROM public.audit_events WHERE entity_id=v_parent OR entity_id::text LIKE '4d4b1c03-%'
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
      '4d4b1c03@example.invalid','SYNTHETIC','online',v_date,time '12:00',
      'HARNESS:4d4b1c03:ROLLBACK_ONLY');

    UPDATE public.consultation_requests SET message='HARNESS:4d4b1c03:'||v_case WHERE id=v_parent;
    IF v_case<>'C4' THEN
        UPDATE public.consultation_requests SET status='converted' WHERE id=v_parent;
        INSERT INTO public.meetings
          (id,consultation_request_id,scheduled_at,time_zone,duration_minutes,mode,notes,
           assigned_to,created_by,updated_by,booked_by,role_at_booking,booking_attribution_source)
        VALUES ('4d4b1c03-0000-4000-8000-000000000200',v_parent,
          (v_date+time '12:00') AT TIME ZONE 'UTC','UTC',45,'online','SYNTHETIC BEFORE',
          v_seller,v_actor,v_actor,v_actor,v_role,'explicit');
    END IF;
    RAISE NOTICE 'PASS setup %; synthetic fixture only; cleanup required',v_case;
END;
$harness$;
\set setup_failed :ERROR
\if :setup_failed
  ROLLBACK;
  \set ON_ERROR_STOP on
  DO $failure$ BEGIN RAISE EXCEPTION 'FAIL harness stopped; inspect earlier error and residue'; END; $failure$;
\else
  COMMIT;
\endif
\set ON_ERROR_STOP on
