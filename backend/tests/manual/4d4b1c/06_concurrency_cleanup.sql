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

\set h_meeting_ids '{}'
\set h_audit_ids '{}'
\set h_idemp_ids '{}'
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL idle_in_transaction_session_timeout='90s';
\set ON_ERROR_STOP off

DO $harness$
DECLARE
    v_parent constant uuid := '4d4b1c03-0000-4000-8000-000000000100';
    v_marker text; v_ids uuid[];
BEGIN
    IF NOT pg_try_advisory_xact_lock(hashtextextended('HARNESS:4d4b1c03',0)) THEN
        RAISE EXCEPTION 'FAIL harness setup/cleanup busy';
    END IF;
    SELECT message INTO v_marker FROM public.consultation_requests
      WHERE id=v_parent AND full_name='SYNTHETIC 4D.4B.1C'
        AND email='4d4b1c03@example.invalid' AND phone='0000000000' AND city='SYNTHETIC'
      FOR UPDATE;
    IF v_marker IS NULL OR v_marker NOT IN
      ('HARNESS:4d4b1c03:C1','HARNESS:4d4b1c03:C2','HARNESS:4d4b1c03:C3_NOTES',
       'HARNESS:4d4b1c03:C3_ATTRIBUTION','HARNESS:4d4b1c03:C4') THEN
        RAISE EXCEPTION 'FAIL missing/unowned fixture; never delete by prefix alone';
    END IF;
    IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN
      ('public.consultation_requests'::regclass,'public.meetings'::regclass,
       'public.audit_events'::regclass,'public.idempotency_records'::regclass))
       OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class IN
      ('public.consultation_requests'::regclass,'public.meetings'::regclass,
       'public.audit_events'::regclass,'public.idempotency_records'::regclass))
       OR EXISTS(SELECT 1 FROM pg_constraint WHERE contype='f'
          AND confrelid IN ('public.consultation_requests'::regclass,'public.meetings'::regclass)
          AND conrelid NOT IN ('public.meetings'::regclass,'public.idempotency_records'::regclass)) THEN
        RAISE EXCEPTION 'FAIL cleanup schema changed; re-audit';
    END IF;
    -- Parent lock is acquired before meeting locks; active sessions must finish first.
    PERFORM 1 FROM public.meetings WHERE consultation_request_id=v_parent FOR UPDATE;
END;
$harness$;
\set harness_failed :ERROR
-- Capture ownership before deleting children. Client variables survive COMMIT.
SELECT coalesce(array_agg(id),'{}'::uuid[])::text AS h_meeting_ids FROM public.meetings
  WHERE consultation_request_id='4d4b1c03-0000-4000-8000-000000000100'::uuid \gset
SELECT coalesce(array_agg(id),'{}'::uuid[])::text AS h_audit_ids FROM public.audit_events
  WHERE entity_id='4d4b1c03-0000-4000-8000-000000000100'::uuid OR entity_id=ANY(:'h_meeting_ids'::uuid[])
    OR metadata->>'consultationRequestId'='4d4b1c03-0000-4000-8000-000000000100' \gset
SELECT coalesce(array_agg(id),'{}'::uuid[])::text AS h_idemp_ids FROM public.idempotency_records
  WHERE consultation_request_id='4d4b1c03-0000-4000-8000-000000000100'::uuid \gset
\set manifest_failed :ERROR
\if :harness_failed
  ROLLBACK;
  \set ON_ERROR_STOP on
  DO $failure$ BEGIN RAISE EXCEPTION 'FAIL harness stopped; inspect earlier error and residue'; END; $failure$;
\endif
\if :manifest_failed
  ROLLBACK;
  \set ON_ERROR_STOP on
  DO $failure$ BEGIN RAISE EXCEPTION 'FAIL harness stopped; inspect earlier error and residue'; END; $failure$;
\endif
-- If any DELETE fails, ON_ERROR_STOP closes the dedicated connection and rolls back.
\set ON_ERROR_STOP on
DELETE FROM public.audit_events WHERE id=ANY(:'h_audit_ids'::uuid[]);
DELETE FROM public.idempotency_records WHERE id=ANY(:'h_idemp_ids'::uuid[]);
DELETE FROM public.meetings WHERE consultation_request_id='4d4b1c03-0000-4000-8000-000000000100'::uuid AND id=ANY(:'h_meeting_ids'::uuid[]);
DELETE FROM public.consultation_requests WHERE id='4d4b1c03-0000-4000-8000-000000000100'::uuid
  AND email='4d4b1c03@example.invalid' AND message LIKE 'HARNESS:4d4b1c03:%';
COMMIT;
SELECT
 (SELECT count(*) FROM public.consultation_requests WHERE id='4d4b1c03-0000-4000-8000-000000000100'::uuid) AS residue_consultations,
 (SELECT count(*) FROM public.meetings WHERE consultation_request_id='4d4b1c03-0000-4000-8000-000000000100'::uuid OR id=ANY(:'h_meeting_ids'::uuid[])) AS residue_meetings,
 (SELECT count(*) FROM public.audit_events WHERE id=ANY(:'h_audit_ids'::uuid[])
   OR entity_id='4d4b1c03-0000-4000-8000-000000000100'::uuid OR entity_id=ANY(:'h_meeting_ids'::uuid[])
   OR metadata->>'consultationRequestId'='4d4b1c03-0000-4000-8000-000000000100') AS residue_audit,
 (SELECT count(*) FROM public.idempotency_records WHERE consultation_request_id='4d4b1c03-0000-4000-8000-000000000100'::uuid
   OR id=ANY(:'h_idemp_ids'::uuid[]) OR idempotency_key::text LIKE '4d4b1c03-%') AS residue_idempotency
\gset
SELECT (:residue_consultations+:residue_meetings+:residue_audit+:residue_idempotency)=0 AS residue_zero \gset
\echo 'Residue consultation/meeting/audit/idempotency:' :residue_consultations :residue_meetings :residue_audit :residue_idempotency
\if :residue_zero
  \echo 'PASS cleanup committed and residue=0'
\else
  \echo 'FAIL residue; stop and inspect, never broaden DELETE scope'
  \set ON_ERROR_STOP on
  DO $failure$ BEGIN RAISE EXCEPTION 'FAIL harness stopped; inspect earlier error and residue'; END; $failure$;
\endif
