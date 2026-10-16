import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Contract guards only: no SQL execution, fixtures, sockets or provider imports.
// These checks do not demonstrate PostgreSQL compilation, rollback or concurrency.
const source = await readFile(new URL('../supabase/migrations/20261015120000_cancel_meeting_workflow.sql', import.meta.url), 'utf8');
const sql = source.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const publicFields = ['id', 'consultationRequestId', 'scheduledAt', 'timeZone', 'durationMinutes', 'mode', 'status', 'version'];
const quoted = value => [...value.matchAll(/'([^']*)'/g)].map(match => match[1]);
function section(start, end) {
    const from = sql.indexOf(start);
    const to = sql.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `Missing section: ${start} -> ${end}`);
    return sql.slice(from, to);
}
function ordered(...parts) {
    let last = -1;
    for (const part of parts) {
        const next = sql.indexOf(part);
        assert.ok(next > last, `Missing/out of order: ${part}`);
        last = next;
    }
}
const replay = section('select r.* into v_previous', 'if p_expected_version is null');

test('cancel migration: preserves all audit entity/action pairs', () => {
    const constraint = section('add constraint audit_events_entity_action_valid', 'alter table public.idempotency_records');
    assert.match(constraint, /\(entity_type = 'consultation_request' and action = 'consultation_converted'\) or \(entity_type = 'meeting' and action in \('meeting_created', 'meeting_rescheduled', 'meeting_cancelled'\)\)/);
});

test('cancel migration: preserves operations and adds cancellation', () => {
    const constraint = section('add constraint idempotency_records_operation_valid', 'create function');
    assert.deepEqual(quoted(constraint), ['create_consultation_meeting', 'reschedule_consultation_meeting', 'cancel_consultation_meeting']);
    assert.match(sql, /v_operation constant text := 'cancel_consultation_meeting'/);
});

test('cancel migration: exact signature, invoker, volatility and safe settings', () => {
    assert.match(sql, /create function public\.cancel_consultation_meeting\( p_actor_id uuid, p_meeting_id uuid, p_idempotency_key uuid, p_request_hash text, p_expected_version integer, p_reason text \) returns jsonb language plpgsql volatile security invoker set search_path = pg_catalog, pg_temp set timezone = 'UTC'/);
    assert.doesNotMatch(sql, /security definer|execute\s+(?:format|')|create or replace/i);
});

test('cancel migration: isolation and basic input precede locks', () => {
    ordered("current_setting('transaction_isolation') <> 'read committed'", "message = 'WORKFLOW_ISOLATION_NOT_SUPPORTED'", 'if p_actor_id is null', 'if p_meeting_id is null or p_idempotency_key is null', 'pg_advisory_xact_lock');
    assert.match(sql, /p_request_hash is null or length\(trim\(p_request_hash\)\) = 0/);
});

test('cancel migration: one advisory lock scoped to operation/actor/key', () => {
    assert.equal((sql.match(/pg_advisory_xact_lock/g) || []).length, 1);
    assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\( v_operation \|\| ':' \|\| p_actor_id::text \|\| ':' \|\| p_idempotency_key::text, 0 \)\)/);
});

test('cancel migration: active authorized actor under SHARE before replay', () => {
    ordered('pg_advisory_xact_lock', 'where u.id = p_actor_id for share', "if not found or v_actor.active is distinct from true or v_actor.role not in ('admin', 'agendadora')", 'select r.* into v_previous');
    assert.match(section('select u.* into v_actor', 'select r.* into v_previous'), /message = 'ACTOR_NOT_ALLOWED'/);
});

test('cancel migration: replay scope, hash conflict and no mutable reads/writes', () => {
    assert.match(replay, /r.actor_id = p_actor_id and r.operation = v_operation and r.idempotency_key = p_idempotency_key/);
    assert.match(replay, /if v_previous.request_hash is distinct from p_request_hash then raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED'/);
    assert.doesNotMatch(replay, /from public\.(?:meetings|consultation_requests)|\b(?:update|insert|delete)\b/);
    ordered('return v_response;', 'if p_expected_version is null', 'select m.consultation_request_id', 'if v_old.status', 'if v_old.version');
});

test('cancel migration: replay requires exact eight-field object and types', () => {
    assert.match(replay, /jsonb_typeof\(v_response\) is distinct from 'object'/);
    const arrays = [...replay.matchAll(/array\[([^\]]+)\]/g)].map(match => quoted(match[1]));
    assert.deepEqual(arrays, [publicFields, publicFields]);
    assert.match(replay, /not \(v_response \?& array/);
    assert.match(replay, /\) <> '\{\}'::jsonb/);
    for (const field of ['id', 'consultationRequestId', 'scheduledAt', 'timeZone']) {
        assert.ok(replay.includes(`jsonb_typeof(v_response->'${field}') is distinct from 'string'`));
    }
    for (const field of ['durationMinutes', 'version']) {
        assert.ok(replay.includes(`jsonb_typeof(v_response->'${field}') is distinct from 'number'`));
    }
    assert.match(replay, /\(v_response->>'status'\) is distinct from 'cancelled'/);
    assert.match(replay, /coalesce\(v_response->>'mode', ''\) not in \('online', 'phone', 'office'\)/);
    assert.match(replay, /length\(trim\(v_response->>'timeZone'\)\) = 0/);
});

test('cancel migration: replay validates IDs, finite timestamp, integer ranges and sanitizes casts', () => {
    assert.match(replay, /\(v_response->>'consultationRequestId'\)::uuid is distinct from v_previous.consultation_request_id/);
    assert.match(replay, /\(v_response->>'id'\)::uuid is distinct from p_meeting_id then raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED'/);
    assert.match(replay, /not isfinite\(\(v_response->>'scheduledAt'\)::timestamptz\)/);
    assert.match(replay, /\(v_response->>'durationMinutes'\)::integer <= 0/);
    assert.match(replay, /\(v_response->>'version'\)::integer < 2/);
    assert.match(replay, /exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow or invalid_time_zone_displacement_value or invalid_parameter_value or config_file_error then raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR'/);
});

test('cancel migration: timestamp cast errors 22009/22023 and timezone config errors are sanitized', () => {
    const handler = section('exception when', 'end;');
    for (const condition of ['invalid_time_zone_displacement_value', 'invalid_parameter_value',
        'invalid_datetime_format', 'datetime_field_overflow', 'config_file_error']) {
        assert.ok(handler.includes(condition), `Missing cast condition: ${condition}`);
    }
    assert.match(handler.trim(), /then raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';$/);
});

test('cancel migration: sole handler stays inside replay and does not absorb domain errors', () => {
    assert.equal((sql.match(/\bexception when\b/g) || []).length, 1);
    const block = section("begin if (v_response->>'consultationRequestId')::uuid", 'end;');
    assert.ok(replay.includes(block));
    assert.doesNotMatch(block, /\b(?:select|update|insert|delete)\b/);
    const handler = section('exception when', 'end;');
    assert.doesNotMatch(handler, /others|raise_exception|sqlstate|IDEMPOTENCY_KEY_REUSED/i);
    assert.doesNotMatch(sql, /when others/i);
    assert.match(block, /message = 'IDEMPOTENCY_KEY_REUSED'; end if; exception when/);
    ordered('if v_previous.request_hash is distinct from p_request_hash', 'exception when',
        'return v_response;', 'if p_expected_version is null', 'update public.meetings set');
});

test('cancel migration: ISO date prefix precedes timestamp cast, rejecting special tokens', () => {
    const pattern = '^[0-9]{4,}-[0-9]{2}-[0-9]{2}T';
    const guard = `if (v_response->>'scheduledAt') !~ '${pattern}' then raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR'; end if;`;
    assert.ok(replay.includes(guard));
    ordered(guard, "not isfinite((v_response->>'scheduledAt')::timestamptz)");
    // ASCII subset shared by JS and PostgreSQL regex; not a PostgreSQL execution test.
    const prefix = new RegExp(pattern);
    for (const value of ['now', 'NOW', ' now ', 'today', 'tomorrow', 'yesterday', 'epoch', 'allballs', 'infinity', '-infinity']) {
        assert.equal(prefix.test(value), false, value);
    }
    for (const value of ['2026-10-15T12:00:00+00:00', '2026-10-15T12:00:00.123456+00:00',
        '2026-10-15T12:00:00Z', '12345-10-15T12:00:00+00:00', '0001-10-15T12:00:00+00:00 BC']) {
        assert.equal(prefix.test(value), true, value);
    }
});

test('cancel migration: exact reason allowlist with null rejection and no normalization', () => {
    const input = section('if p_expected_version is null', 'select m.consultation_request_id');
    assert.match(input, /p_expected_version is null or p_expected_version <= 0/);
    assert.match(input, /p_reason is null or p_reason not in/);
    assert.deepEqual(quoted(input), ['client_request', 'staff_unavailable', 'duplicate', 'administrative', 'other', 'P0001', 'INVALID_MEETING_INPUT']);
    assert.doesNotMatch(sql, /(?:trim|lower|upper|coalesce)\(p_reason\)|p_reason\s*:=/);
});

test('cancel migration: discovers parent without lock then locks parent before meeting', () => {
    ordered('select m.consultation_request_id', 'select r.* into v_request', 'where r.id = v_parent_id for update', 'select m.* into v_old', 'where m.id = p_meeting_id for update', 'if v_old.id is distinct from p_meeting_id');
    assert.doesNotMatch(section('select m.consultation_request_id', 'select r.* into v_request'), /for update|for share/);
    assert.match(sql, /v_old.consultation_request_id is distinct from v_parent_id then raise exception using errcode = 'P0001', message = 'CONSULTATION_STATE_INCONSISTENT'/);
    assert.match(section('select m.* into v_old', 'if v_old.id'), /if not found then raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND'/);
});

test('cancel migration: terminal state takes precedence over stale version; parent and overflow before UPDATE', () => {
    ordered("if v_old.status is distinct from 'scheduled'", "message = 'MEETING_NOT_SCHEDULED'", 'if v_old.version is distinct from p_expected_version', "message = 'MEETING_VERSION_CONFLICT'", "if v_request.status is distinct from 'converted'", 'if v_old.version = 2147483647', 'update public.meetings set');
    assert.match(section('if v_old.version = 2147483647', 'update public.meetings set'), /message = 'INTERNAL_ERROR'/);
    assert.match(section("if v_request.status is distinct from 'converted'", 'if v_old.version ='), /message = 'CONSULTATION_STATE_INCONSISTENT'/);
    assert.doesNotMatch(sql, /MEETING_ALREADY_CANCELLED|MEETING_NOT_IN_FUTURE/);
});

test('cancel migration: sole UPDATE has exact whitelist and preserves consultation', () => {
    assert.deepEqual([...sql.matchAll(/\bupdate public\.(\w+) set (.*?) where /g)].map(m => [m[1], m[2]]), [
        ['meetings', "status = 'cancelled', updated_by = p_actor_id, updated_at = clock_timestamp(), version = version + 1"],
    ]);
    assert.match(sql, /where id = v_old.id returning \* into v_meeting/);
    assert.doesNotMatch(sql, /\bdelete\b|insert into public\.meetings|alter table public\.meetings/);
});

test('cancel migration: one audit with exact metadata, actor and independent operation UUID', () => {
    assert.equal((sql.match(/insert into public.audit_events/g) || []).length, 1);
    const audit = section('insert into public.audit_events', 'v_response := jsonb_build_object');
    assert.match(audit, /\(actor_id, entity_type, entity_id, action, metadata, operation_id\) values \(p_actor_id, 'meeting', v_meeting.id, 'meeting_cancelled'/);
    assert.match(audit, /jsonb_build_object\( 'consultationRequestId', v_parent_id, 'previousStatus', v_old.status, 'newStatus', v_meeting.status, 'previousVersion', v_old.version, 'newVersion', v_meeting.version, 'reason', p_reason \), gen_random_uuid\(\)\)/);
    assert.doesNotMatch(audit, /notes|email|phone|p_idempotency_key|p_request_hash/);
});

test('cancel migration: exact response and single persistence after update/audit', () => {
    const response = section('v_response := jsonb_build_object', 'insert into public.idempotency_records');
    assert.deepEqual(quoted(response), publicFields);
    ordered('update public.meetings set', 'insert into public.audit_events', 'v_response := jsonb_build_object', 'insert into public.idempotency_records');
    assert.equal((sql.match(/insert into public.idempotency_records/g) || []).length, 1);
    assert.match(sql, /insert into public.idempotency_records \( actor_id, operation, idempotency_key, request_hash, consultation_request_id, response_payload \) values \( p_actor_id, v_operation, p_idempotency_key, p_request_hash, v_parent_id, v_response \); return v_response;/);
    assert.doesNotMatch(sql, /\bcommit\b|\brollback\b|exception when others/);
});

test('cancel migration: only function privileges change; exact signature service_role only', () => {
    const permissions = sql.slice(sql.indexOf('revoke all privileges'));
    assert.equal(permissions, 'revoke all privileges on function public.cancel_consultation_meeting( uuid, uuid, uuid, text, integer, text ) from public, anon, authenticated, service_role; grant execute on function public.cancel_consultation_meeting( uuid, uuid, uuid, text, integer, text ) to service_role;');
    assert.equal((sql.match(/\bgrant\b/g) || []).length, 1);
    assert.doesNotMatch(sql, /disable row level security|create policy|grant .* on table/);
});
