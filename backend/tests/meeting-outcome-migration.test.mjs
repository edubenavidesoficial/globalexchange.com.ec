import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Static contract checks only. No PostgreSQL execution, network or credentials.
const read = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const compact = text => text.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const source = await read('20261020120000_meeting_outcome_workflow.sql');
const sql = compact(source);
const fields = ['id', 'consultationRequestId', 'scheduledAt', 'timeZone', 'durationMinutes', 'mode', 'status', 'version'];
const quoted = text => [...text.matchAll(/'([^']*)'/g)].map(m => m[1]);
// Match the entire ADD statement, not just its literals or a permissive prefix.
const normalizeCheck = text => compact(text).replace(/\s*([(),=])\s*/g, '$1');
function checkDefinition(text, table, constraint) {
    const statements = [...compact(text).matchAll(new RegExp(
        `\\balter table public\\.${table} add constraint ${constraint}\\b([^;]*);`, 'gi'
    ))];
    assert.equal(statements.length, 1, `Expected exactly one ADD CONSTRAINT ${constraint}`);
    const definition = statements[0][1].trim();
    assert.match(definition, /^check\s*\([\s\S]*\)$/i);
    return normalizeCheck(definition);
}
const expectedAuditCheck = normalizeCheck(`check (
    (entity_type = 'consultation_request' and action = 'consultation_converted')
    or (entity_type = 'meeting' and action in (
        'meeting_created', 'meeting_rescheduled', 'meeting_cancelled',
        'meeting_completed', 'meeting_no_show'))
)`);
const expectedOperationCheck = normalizeCheck(`check (
    operation in ('create_consultation_meeting', 'reschedule_consultation_meeting',
        'cancel_consultation_meeting', 'complete_consultation_meeting',
        'mark_consultation_meeting_no_show')
)`);
const assertAuditCheck = text => assert.equal(
    checkDefinition(text, 'audit_events', 'audit_events_entity_action_valid'), expectedAuditCheck);
const assertOperationCheck = text => assert.equal(
    checkDefinition(text, 'idempotency_records', 'idempotency_records_operation_valid'), expectedOperationCheck);
function between(text, start, end) {
    const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, `Missing boundaries: ${start} / ${end}`);
    return text.slice(a, b);
}
function ordered(text, ...parts) {
    let previous = -1;
    for (const part of parts) {
        const next = text.indexOf(part, previous + 1);
        assert.ok(next > previous, `Missing/out of order: ${part}`);
        previous = next;
    }
}
function functionText(text, name) {
    const match = text.match(new RegExp(`create (?:or replace )?function public\\.${name}\\([\\s\\S]*?\\$\\$;`, 'i'));
    assert.ok(match, name);
    return compact(match[0]);
}
const historical = await read('20261007040229_create_meetings_workflow.sql');
const creation = functionText(source, 'create_consultation_meeting');
const oldCreation = functionText(historical, 'create_consultation_meeting');

test('outcome migration: one atomic migration with exactly three explicit functions', () => {
    assert.match(sql, /^BEGIN; /); assert.match(sql, / COMMIT;$/);
    assert.equal((sql.match(/\bBEGIN;/g) || []).length, 1);
    assert.equal((sql.match(/\bCOMMIT;/g) || []).length, 1);
    assert.deepEqual([...sql.matchAll(/create (?:or replace )?function public\.(\w+)/g)].map(m => m[1]),
        ['create_consultation_meeting', 'complete_consultation_meeting', 'mark_consultation_meeting_no_show']);
    assert.doesNotMatch(sql, /create table|add column|(?:create|drop|alter) (?:unique )?index|meetings_status_valid|create policy|row level security|security definer|when others|\bexecute\s+(?:format|')/i);
});
test('outcome migration: exact audit entity pairs and no reassignment', () => {
    assertAuditCheck(source);
    const audit = between(sql, 'add constraint audit_events_entity_action_valid', 'alter table public.idempotency_records');
    assert.match(audit, /\(entity_type = 'consultation_request' and action = 'consultation_converted'\) or \(entity_type = 'meeting' and action in/);
    assert.deepEqual(quoted(audit), ['consultation_request', 'consultation_converted', 'meeting',
        'meeting_created', 'meeting_rescheduled', 'meeting_cancelled', 'meeting_completed', 'meeting_no_show']);
});
test('outcome migration: exact five operations preserve previous three', () => {
    assertOperationCheck(source);
    assert.deepEqual(quoted(between(sql, 'add constraint idempotency_records_operation_valid', 'create or replace function')),
        ['create_consultation_meeting', 'reschedule_consultation_meeting', 'cancel_consultation_meeting',
            'complete_consultation_meeting', 'mark_consultation_meeting_no_show']);
});
test('outcome constraints: audit OR true is rejected by full CHECK comparison', () => {
    const mutant = source.replace(
        /('meeting_cancelled', 'meeting_completed', 'meeting_no_show'\)\))(\s*\);)/,
        (_, predicate, end) => `${predicate} or true${end}`
    );
    assert.notEqual(mutant, source, 'Mutation must alter the audit CHECK');
    assert.throws(() => assertAuditCheck(mutant), { code: 'ERR_ASSERTION' });
});
test('outcome constraints: operation NOT IN and permissive OR are rejected', () => {
    const negated = source.replace(
        "operation in ('create_consultation_meeting'",
        "operation not in ('create_consultation_meeting'"
    );
    const permissive = source.replace(
        /('mark_consultation_meeting_no_show'\))(\s*\);)/,
        (_, predicate, end) => `${predicate} or true${end}`
    );
    for (const mutant of [negated, permissive]) {
        assert.notEqual(mutant, source, 'Mutation must alter the operation CHECK');
        assert.throws(() => assertOperationCheck(mutant), { code: 'ERR_ASSERTION' });
    }
});
test('outcome migration: historical migrations unchanged, normalized line endings', async () => {
    for (const [name, hash] of [
        ['20261007040229_create_meetings_workflow.sql', '0c7ce5f4cb4fe055dbb5397c8c9f7726461b38ae2cc4429d228a13f3ad65a982'],
        ['20261013211621_reschedule_meeting_workflow.sql', '2920caa51a16f8298c5b37a462f46c95d35dea45bfbb177cc24ccec0acbc44fd'],
        ['20261015120000_cancel_meeting_workflow.sql', '809f11f07b0dcda0dfd4d347c51cb1881aab329d57d69f6b47b5f9f0f88fcf52'],
    ]) assert.equal(createHash('sha256').update((await read(name)).replaceAll('\r\n', '\n')).digest('hex'), hash);
});
test('outcome creation: equivalent to historical function except completed exclusion', () => {
    const expected = oldCreation.replace('create function', 'create or replace function')
        .replace('v_has_completed boolean; ', '')
        .replace("coalesce(bool_or(m.status = 'completed'), false), ", '')
        .replace('v_has_scheduled, v_has_completed, v_has_unknown', 'v_has_scheduled, v_has_unknown')
        .replace("if v_has_completed then raise exception using errcode = 'P0001', message = 'CONSULTATION_COMPLETED'; end if; ", '');
    assert.equal(creation, expected);
});
test('outcome creation: terminal history admitted, scheduled and incoherence still rejected', () => {
    assert.doesNotMatch(creation, /v_has_completed|CONSULTATION_COMPLETED|update public\.meetings|delete /);
    assert.match(creation, /m.status not in \('scheduled', 'completed', 'cancelled', 'no_show'\)/);
    assert.match(creation, /if v_has_scheduled then raise exception using errcode = 'P0001', message = 'CONSULTATION_ALREADY_SCHEDULED'/);
    assert.match(creation, /v_request.status = 'converted' and v_history_count = 0/);
    assert.match(creation, /v_request.status in \('pending', 'cancelled'\) and v_history_count > 0/);
    assert.match(creation, /v_constraint = 'meetings_one_scheduled_per_consultation_idx'/);
    assert.match(creation, /if v_request.status = 'pending' then update public.consultation_requests/);
});
test('outcome creation: exact historical permission statements preserved', () => {
    const permissions = compact(historical.slice(historical.indexOf('revoke all privileges on function')));
    assert.ok(sql.includes(permissions));
    assert.equal((sql.match(/\bgrant execute\b/g) || []).length, 3);
    assert.doesNotMatch(sql, /grant .*? to (?:anon|authenticated|public);|grant .*? on table/i);
});

for (const [name, status, action] of [
    ['complete_consultation_meeting', 'completed', 'meeting_completed'],
    ['mark_consultation_meeting_no_show', 'no_show', 'meeting_no_show'],
]) {
    const f = functionText(source, name);
    const replay = between(f, 'if v_replay then', 'select m.consultation_request_id');
    const ownership = between(f, "if v_actor.role = 'vendedora'", 'if p_expected_version');
    test(`${name}: exact signature and secure function properties`, () => {
        assert.ok(f.startsWith(`create function public.${name}( p_actor_id uuid, p_meeting_id uuid, p_idempotency_key uuid, p_request_hash text, p_expected_version integer ) returns jsonb language plpgsql volatile security invoker set search_path = pg_catalog, pg_temp set timezone = 'UTC' as $$`));
        assert.doesNotMatch(f, /p_status|p_reason|p_notes|p_assigned_to|p_scheduled|security definer|\bexecute\b|when others/i);
        assert.doesNotMatch(f, /(?:from|into|update)\s+(?:meetings|consultation_requests|internal_users|audit_events|idempotency_records)\b/);
    });
    test(`${name}: exact revoke and service_role only grant`, () => {
        const signature = `${name}( uuid, uuid, uuid, text, integer )`;
        assert.ok(sql.includes(`revoke all privileges on function public.${signature} from public, anon, authenticated, service_role;`));
        assert.ok(sql.includes(`grant execute on function public.${signature} to service_role;`));
    });
    test(`${name}: isolation and identifiers before one scoped advisory lock`, () => {
        ordered(f, "current_setting('transaction_isolation') <> 'read committed'", 'if p_actor_id is null',
            'if p_meeting_id is null or p_idempotency_key is null', 'pg_advisory_xact_lock');
        assert.match(f, /p_actor_id is null then raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED'/);
        assert.match(f, /p_request_hash is null or length\(trim\(p_request_hash\)\) = 0 then raise exception using errcode = 'P0001', message = 'INVALID_REQUEST'/);
        assert.equal((f.match(/pg_advisory_xact_lock/g) || []).length, 1);
        assert.ok(f.includes(`v_operation constant text := '${name}'`));
        assert.match(f, /hashtextextended\( v_operation \|\| ':' \|\| p_actor_id::text \|\| ':' \|\| p_idempotency_key::text, 0 \)/);
    });
    test(`${name}: actor active admin or seller locked before idempotency`, () => {
        ordered(f, 'where u.id = p_actor_id for share', 'select r.* into v_previous');
        assert.match(f, /if not found or v_actor.active is distinct from true or v_actor.role not in \('admin', 'vendedora'\) then raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED'/);
        assert.doesNotMatch(f, /agendadora/);
    });
    test(`${name}: replay lookup and exact hash/meeting mismatch semantics`, () => {
        assert.match(f, /r.actor_id = p_actor_id and r.operation = v_operation and r.idempotency_key = p_idempotency_key; v_replay := found/);
        assert.match(replay, /v_previous.request_hash is distinct from p_request_hash then raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED'/);
        assert.match(replay, /\(v_response->>'id'\)::uuid is distinct from p_meeting_id then raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED'/);
        assert.doesNotMatch(replay, /return |update public|insert into/);
    });
    test(`${name}: replay exact eight fields, JSON types and target status`, () => {
        assert.deepEqual([...replay.matchAll(/array\[([^\]]+)\]/g)].map(m => quoted(m[1])), [fields, fields]);
        assert.match(replay, /not \(v_response \?& array/); assert.match(replay, /<> '\{\}'::jsonb/);
        for (const key of ['id', 'consultationRequestId', 'scheduledAt', 'timeZone'])
            assert.ok(replay.includes(`jsonb_typeof(v_response->'${key}') is distinct from 'string'`));
        for (const key of ['durationMinutes', 'version'])
            assert.ok(replay.includes(`jsonb_typeof(v_response->'${key}') is distinct from 'number'`));
        assert.ok(replay.includes(`(v_response->>'status') is distinct from '${status}'`));
        assert.match(replay, /coalesce\(v_response->>'mode', ''\) not in \('online', 'phone', 'office'\)/);
        assert.match(replay, /length\(trim\(v_response->>'timeZone'\)\) = 0/);
    });
    test(`${name}: replay finite ISO timestamp, UUID coherence and integer casts`, () => {
        assert.match(replay, /scheduledAt'\) !~ '\^\[0-9\]\{4,\}-\[0-9\]\{2\}-\[0-9\]\{2\}T'/);
        assert.match(replay, /not isfinite\(\(v_response->>'scheduledAt'\)::timestamptz\)/);
        assert.match(replay, /\(v_response->>'consultationRequestId'\)::uuid is distinct from v_previous.consultation_request_id/);
        for (const key of ['durationMinutes', 'version']) assert.ok(replay.includes(`(v_response->>'${key}') !~ '^[0-9]+$'`));
        assert.match(replay, /\(v_response->>'durationMinutes'\)::integer <= 0/);
        assert.match(replay, /\(v_response->>'version'\)::integer < 2/);
        assert.match(replay, /exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow or invalid_time_zone_displacement_value or invalid_parameter_value or config_file_error then raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR'/);
    });
    test(`${name}: parent before meeting, ownership under lock before replay return`, () => {
        ordered(f, 'select m.consultation_request_id', 'where r.id = v_parent_id for update',
            'where m.id = p_meeting_id for update', "if v_actor.role = 'vendedora'", 'return v_response;',
            'if p_expected_version');
        assert.match(ownership, /v_old.assigned_to is distinct from p_actor_id then raise exception using errcode = 'P0001', message = 'ACTOR_NOT_ALLOWED'/);
        assert.match(ownership, /v_previous.consultation_request_id is distinct from v_parent_id/);
        assert.doesNotMatch(ownership, /v_old.status|v_old.version|clock_timestamp|v_request.status|update public|insert into/);
        assert.match(f, /v_old.consultation_request_id is distinct from v_parent_id/);
        assert.match(f, /where m.id = p_meeting_id for update; if not found then raise exception using errcode = 'P0001', message = 'MEETING_NOT_FOUND'/);
    });
    test(`${name}: new command status precedes version, converted and overflow required`, () => {
        ordered(f, 'if p_expected_version is null or p_expected_version < 1',
            "if v_old.status is distinct from 'scheduled'", "message = 'MEETING_NOT_SCHEDULED'",
            'if v_old.version is distinct from p_expected_version', "message = 'MEETING_VERSION_CONFLICT'",
            "if v_request.status is distinct from 'converted'", 'if v_old.version = 2147483647',
            "message = 'MEETING_TOO_EARLY'", 'update public.meetings set');
        assert.match(f, /v_old.version = 2147483647 then raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR'/);
    });
    test(`${name}: exact four mutated fields and no consultation/history writes`, () => {
        assert.deepEqual([...f.matchAll(/update public\.(\w+) set (.*?) where /g)].map(m => [m[1], m[2]]),
            [['meetings', `status = '${status}', updated_by = p_actor_id, updated_at = clock_timestamp(), version = version + 1`]]);
        assert.match(f, /where id = v_old.id returning \* into v_meeting/);
        assert.doesNotMatch(f, /insert into public.meetings|update public.consultation_requests|\bdelete\b/);
    });
    test(`${name}: audit exact metadata, actor, action and independent operation UUID`, () => {
        const audit = between(f, 'insert into public.audit_events', 'v_response := jsonb_build_object');
        assert.deepEqual(quoted(audit), ['meeting', action, 'consultationRequestId', 'previousStatus', 'newStatus', 'previousVersion', 'newVersion']);
        assert.match(audit, /values \(p_actor_id, 'meeting', v_meeting.id/);
        assert.match(audit, /'consultationRequestId', v_parent_id, 'previousStatus', v_old.status, 'newStatus', v_meeting.status, 'previousVersion', v_old.version, 'newVersion', v_meeting.version \), gen_random_uuid\(\)/);
        assert.doesNotMatch(audit, /notes|email|phone|p_idempotency_key|p_request_hash|assigned_to/);
    });
    test(`${name}: update then audit then exact response then single idempotency insert`, () => {
        const response = between(f, 'v_response := jsonb_build_object', 'insert into public.idempotency_records');
        assert.deepEqual(quoted(response), fields);
        ordered(f, 'update public.meetings set', 'insert into public.audit_events', 'v_response := jsonb_build_object',
            'insert into public.idempotency_records');
        for (const table of ['audit_events', 'idempotency_records']) assert.equal((f.match(new RegExp(`insert into public\\.${table}`, 'g')) || []).length, 1);
        assert.match(f, /values \( p_actor_id, v_operation, p_idempotency_key, p_request_hash, v_parent_id, v_response \); return v_response; end; \$\$;/);
        assert.doesNotMatch(f, /\bcommit\b|\brollback\b|when others|when raise_exception/i);
    });
    test(`${name}: server temporal rule after locks and before mutation`, () => {
        if (status === 'completed') {
            assert.match(f, /if clock_timestamp\(\) < v_old.scheduled_at then raise exception using errcode = 'P0001', message = 'MEETING_TOO_EARLY'/);
            assert.doesNotMatch(f, /make_interval|v_end_at/);
        } else {
            assert.match(f, /begin v_end_at := v_old.scheduled_at \+ make_interval\(mins => v_old.duration_minutes\); exception when datetime_field_overflow or interval_field_overflow or numeric_value_out_of_range then raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR'; end;/);
            assert.match(f, /if not isfinite\(v_end_at\)/);
            assert.match(f, /if clock_timestamp\(\) < v_end_at then raise exception using errcode = 'P0001', message = 'MEETING_TOO_EARLY'/);
        }
    });
}
