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
SET LOCAL application_name='HARNESS_4D4B1C_B';
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
    v_expected_audits bigint; v_expected_records bigint; v_expected_revision integer;
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

    -- No locking read before the RPC: its advisory/parent/meeting locks must cause the wait.
    v_expected := CASE WHEN v_case='C1' THEN NULL WHEN v_case='C4' THEN 'CONSULTATION_ALREADY_SCHEDULED'
        ELSE 'MEETING_VERSION_CONFLICT' END;
    v_error := NULL;
    BEGIN
        IF v_case='C4' THEN
            v_result := public.create_consultation_meeting(v_actor,v_parent,
              '4d4b1c03-0000-4000-8000-000000000002','harness:concurrency:B',
              v_date,time '12:00','UTC',45,'online',v_seller,NULL);
        ELSE
            v_result := public.reschedule_consultation_meeting(v_actor,v_id,
              CASE WHEN v_case='C1' THEN '4d4b1c03-0000-4000-8000-000000000001'::uuid
                   ELSE '4d4b1c03-0000-4000-8000-000000000002'::uuid END,
              CASE WHEN v_case='C1' THEN 'harness:concurrency:A' ELSE 'harness:concurrency:B' END,
              1,v_date+1,time '12:00','UTC',45,'online');
        END IF;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN v_error := SQLERRM;
    END;
    IF v_error IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION 'FAIL B wrong/missing P0001: expected %, got %',v_expected,v_error;
    END IF;
    SELECT count(*) INTO v_audits FROM public.audit_events WHERE entity_id=v_parent
      OR entity_id IN (SELECT id FROM public.meetings WHERE consultation_request_id=v_parent);
    SELECT count(*) INTO v_records FROM public.idempotency_records WHERE consultation_request_id=v_parent;
    v_expected_audits := CASE WHEN v_case='C4' THEN 2 ELSE 1 END;
    v_expected_records := CASE WHEN v_case='C3_NOTES' THEN 0 ELSE 1 END;
    IF v_audits <> v_expected_audits OR v_records <> v_expected_records THEN
        RAISE EXCEPTION 'FAIL B unexpected audit/idempotency after replay/conflict';
    END IF;
    IF v_case='C4' THEN
        IF (SELECT count(*) FROM public.meetings WHERE consultation_request_id=v_parent)<>1
           OR (SELECT count(*) FROM public.meetings WHERE consultation_request_id=v_parent AND status='scheduled')<>1 THEN
            RAISE EXCEPTION 'FAIL C4 more than one winner';
        END IF;
    ELSE
        SELECT * INTO STRICT v_before FROM public.meetings WHERE id=v_id AND consultation_request_id=v_parent;
        v_expected_revision := CASE WHEN v_case IN ('C1','C2') THEN 2 ELSE 1 END;
        IF v_before.version<>2 OR v_before.schedule_revision <> v_expected_revision THEN
            RAISE EXCEPTION 'FAIL B changed counters on replay/conflict';
        END IF;
        IF v_case='C1' THEN
            SELECT response_payload INTO STRICT v_saved FROM public.idempotency_records
              WHERE actor_id=v_actor AND operation='reschedule_consultation_meeting'
                AND idempotency_key='4d4b1c03-0000-4000-8000-000000000001';
            IF v_result IS DISTINCT FROM v_saved THEN RAISE EXCEPTION 'FAIL C1 snapshot'; END IF;
        ELSIF v_case IN ('C3_NOTES','C3_ATTRIBUTION') THEN
            IF (v_case='C3_NOTES' AND v_before.notes IS DISTINCT FROM 'SYNTHETIC AFTER')
               OR (v_case='C3_ATTRIBUTION' AND (v_before.booked_by IS DISTINCT FROM v_actor
                 OR v_before.role_at_booking IS DISTINCT FROM v_role
                 OR v_before.booking_attribution_source IS DISTINCT FROM 'administrative_correction')) THEN
                RAISE EXCEPTION 'FAIL C3 context from A lost';
            END IF;
            v_result := public.reschedule_consultation_meeting(v_actor,v_id,
              '4d4b1c03-0000-4000-8000-000000000003','harness:concurrency:retry',
              v_before.version,v_date+1,time '12:00','UTC',45,'online');
            SELECT * INTO STRICT v_after FROM public.meetings WHERE id=v_id AND consultation_request_id=v_parent;
            IF v_after.version<>3 OR v_after.schedule_revision<>2
               OR ROW(v_after.booked_by,v_after.role_at_booking,v_after.booking_attribution_source,v_after.notes)
                  IS DISTINCT FROM ROW(v_before.booked_by,v_before.role_at_booking,v_before.booking_attribution_source,v_before.notes)
               OR (SELECT count(*) FROM public.audit_events WHERE entity_id=v_id)<>v_audits+1
               OR (SELECT count(*) FROM public.idempotency_records WHERE consultation_request_id=v_parent)<>v_records+1 THEN
                RAISE EXCEPTION 'FAIL C3 retry lost context or wrong counters/audit/idempotency';
            END IF;
        END IF;
    END IF;
    RAISE NOTICE 'PASS B %; observer evidence required to claim concurrency',v_case;
END;
$harness$;
\set b_failed :ERROR
\if :b_failed
  ROLLBACK;
  \set ON_ERROR_STOP on
  DO $failure$ BEGIN RAISE EXCEPTION 'FAIL harness stopped; inspect earlier error and residue'; END; $failure$;
\else
  COMMIT;
\endif
\set ON_ERROR_STOP on
\echo 'Run 06_concurrency_cleanup.sql after BOTH sessions ended, even if a test failed'
