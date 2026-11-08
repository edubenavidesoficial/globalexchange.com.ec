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

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL application_name='HARNESS_4D4B1C_A';
SET LOCAL lock_timeout='120s';
SET LOCAL statement_timeout='150s';
SET LOCAL idle_in_transaction_session_timeout='180s';
\set ON_ERROR_STOP off
DO $harness$
DECLARE
    v_parent constant uuid := '4d4b1c03-0000-4000-8000-000000000100';
    v_id constant uuid := '4d4b1c03-0000-4000-8000-000000000200';
    v_actor uuid; v_role text; v_seller uuid; v_date date; v_case text; v_marker text;
    v_result jsonb; v_saved jsonb; v_error text; v_expected text;
    v_before public.meetings%rowtype; v_after public.meetings%rowtype;
    v_audits bigint; v_records bigint;
    v_expected_revision integer;
BEGIN
    SELECT message,preferred_date INTO v_marker,v_date FROM public.consultation_requests
      WHERE id=v_parent AND full_name='SYNTHETIC 4D.4B.1C' AND email='4d4b1c03@example.invalid';
    IF v_marker IS NULL OR v_marker NOT IN
       ('HARNESS:4d4b1c03:C1','HARNESS:4d4b1c03:C2','HARNESS:4d4b1c03:C3_NOTES',
        'HARNESS:4d4b1c03:C3_ATTRIBUTION','HARNESS:4d4b1c03:C4') THEN
        RAISE EXCEPTION 'FAIL missing/unowned concurrency fixture';
    END IF;
    v_case := split_part(v_marker,':',3);
    SELECT id,role INTO v_actor,v_role FROM public.internal_users WHERE active AND role='admin' ORDER BY id LIMIT 1;
    SELECT id INTO v_seller FROM public.internal_users WHERE active AND role='vendedora' ORDER BY id LIMIT 1;
    IF v_actor IS NULL OR v_seller IS NULL THEN RAISE EXCEPTION 'FAIL missing actors'; END IF;

    IF v_case='C4' THEN
        v_result := public.create_consultation_meeting(v_actor,v_parent,
          '4d4b1c03-0000-4000-8000-000000000001','harness:concurrency:A',
          v_date,time '12:00','UTC',45,'online',v_seller,NULL);
        IF (SELECT count(*) FROM public.meetings WHERE consultation_request_id=v_parent AND status='scheduled')<>1 THEN
            RAISE EXCEPTION 'FAIL C4 A';
        END IF;
    ELSE
        SELECT * INTO STRICT v_before FROM public.meetings WHERE id=v_id AND consultation_request_id=v_parent;
        IF v_before.version<>1 OR v_before.schedule_revision<>1 OR v_before.status<>'scheduled'
           OR v_before.booking_attribution_source<>'explicit' THEN RAISE EXCEPTION 'FAIL A fixture already consumed'; END IF;
        IF v_case IN ('C1','C2') THEN
            v_result := public.reschedule_consultation_meeting(v_actor,v_id,
              '4d4b1c03-0000-4000-8000-000000000001','harness:concurrency:A',1,
              v_date+1,time '12:00','UTC',45,'online');
        ELSIF v_case='C3_NOTES' THEN
            v_result := public.update_meeting_notes(v_actor,v_id,1,'SYNTHETIC AFTER',NULL);
        ELSE
            v_result := public.correct_meeting_booking_attribution(v_actor,v_id,
              '4d4b1c03-0000-4000-8000-000000000001','harness:concurrency:A',1,
              v_actor,v_role,'verified_information');
        END IF;
        SELECT * INTO STRICT v_after FROM public.meetings WHERE id=v_id AND consultation_request_id=v_parent;
        v_expected_revision := CASE WHEN v_case IN ('C1','C2') THEN 2 ELSE 1 END;
        IF v_after.version<>2 OR v_after.schedule_revision <> v_expected_revision THEN
            RAISE EXCEPTION 'FAIL A counters';
        END IF;
        IF (v_case='C3_NOTES' AND v_after.notes IS DISTINCT FROM 'SYNTHETIC AFTER')
           OR (v_case='C3_ATTRIBUTION' AND (v_after.booked_by IS DISTINCT FROM v_actor
              OR v_after.role_at_booking IS DISTINCT FROM v_role
              OR v_after.booking_attribution_source IS DISTINCT FROM 'administrative_correction')) THEN
            RAISE EXCEPTION 'FAIL A context';
        END IF;
    END IF;
    RAISE NOTICE 'PASS A mutation held uncommitted; start B and verify blocking from observer';
END;
$harness$;
\set a_failed :ERROR
\if :a_failed
  ROLLBACK;
  \set ON_ERROR_STOP on
  DO $failure$ BEGIN RAISE EXCEPTION 'FAIL harness stopped; inspect earlier error and residue'; END; $failure$;
\endif
\set ON_ERROR_STOP on
\echo 'READY_A: start B now; observer must show B blocked by A before releasing'
\prompt 'After observed blocking, type true to COMMIT A, false to ROLLBACK: ' release_a
\if :release_a
  COMMIT;
\else
  ROLLBACK;
  \echo 'Race cancelled; stop B and run cleanup'
  \set ON_ERROR_STOP on
  DO $failure$ BEGIN RAISE EXCEPTION 'FAIL harness stopped; inspect earlier error and residue'; END; $failure$;
\endif
