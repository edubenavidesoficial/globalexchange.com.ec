import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Static contracts only: no SQL execution, network, credentials or database fixtures.
// Equivalence checks protect the entire published body, including replay limitations.
const read = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const source = await read('20261022030000_meeting_context_schedule_workflows.sql');
// Lexical shielding only: quoted values/identifiers stay byte-for-byte intact.
// The $$ function bodies are inspected as PL/pgSQL source, not executed.
function normalize(text, punctuation = false) {
    assert.ok(!text.includes('\0'), 'NUL is not valid SQL source');
    const literals = [];
    let structural = '';
    let bodyDelimiter = null;
    for (let i = 0; i < text.length;) {
        const dollar = text[i] === '$' && text.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
        if (dollar) {
            if (dollar === bodyDelimiter) {
                structural += dollar;
                i += dollar.length;
                bodyDelimiter = null;
            } else if (bodyDelimiter === null && /\bas\s*$/i.test(structural)) {
                // Inspect function source inside AS $...$, shielding its own literals.
                bodyDelimiter = dollar;
                structural += dollar;
                i += dollar.length;
            } else {
                const end = text.indexOf(dollar, i + dollar.length);
                assert.ok(end >= 0, 'Unterminated dollar quote');
                structural += '\0' + literals.length + '\0';
                literals.push(text.slice(i, end + dollar.length));
                i = end + dollar.length;
            }
        } else if (text.startsWith('--', i)) {
            const end = text.indexOf('\n', i);
            i = end < 0 ? text.length : end;
            structural += ' ';
        } else if (text.startsWith('/*', i)) {
            let depth = 1;
            i += 2;
            while (i < text.length && depth) {
                if (text.startsWith('/*', i)) { depth++; i += 2; }
                else if (text.startsWith('*/', i)) { depth--; i += 2; }
                else i++;
            }
            assert.equal(depth, 0, 'Unterminated SQL comment');
            structural += ' ';
        } else if (text[i] === "'" || text[i] === '"') {
            const start = i, quote = text[i++];
            const escaped = quote === "'" && /(^|[^\w$])[eE]$/.test(text.slice(0, start));
            let closed = false;
            while (i < text.length) {
                if (escaped && text[i] === '\\') { i += 2; }
                else if (text[i] === quote && text[i + 1] === quote) { i += 2; }
                else if (text[i++] === quote) { closed = true; break; }
            }
            assert.ok(closed, 'Unterminated SQL quote');
            structural += '\0' + literals.length + '\0';
            literals.push(text.slice(start, i));
        } else {
            structural += text[i++];
        }
    }
    assert.equal(bodyDelimiter, null, 'Unterminated function body');
    structural = structural.replace(/\s+/g, ' ').trim();
    if (punctuation) structural = structural.replace(/\s*([(),;])\s*/g, '$1');
    return structural.replace(/\0(\d+)\0/g, (_, index) => literals[Number(index)]);
}
const compact = text => normalize(text);
const norm = text => normalize(text, true);
test('normalization preserves literal whitespace, punctuation, escaped quotes and comment markers', () => {
    const literals = ["'read  committed'", "'a  -- b\n c /* d */'", "'it''s  ( a, b );'", String.raw`E'it\'s  -- ( x )'`, '"quoted  identifier"', '$tag$a  -- b\n ( c );$tag$', '$$a  b$$'];
    for (const literal of literals) {
        assert.equal(compact('  select\n ' + literal + '  ; -- comment'), 'select ' + literal + ' ;');
        assert.equal(norm('  select\n ' + literal + '  ; -- comment'), 'select ' + literal + ';');
    }
    assert.equal(compact('select /* outer /* inner */ end */  1'), 'select 1');
    assert.equal(compact("as $$\n begin  perform $tag$a  -- b$tag$;\n end; $$;"),
        'as $$ begin perform $tag$a  -- b$tag$; end; $$;');
    assert.notEqual(compact("'read committed'"), compact("'read  committed'"));
    assert.throws(() => compact("select 'unterminated"), assert.AssertionError);
});
const createName = 'create_consultation_meeting';
const rescheduleName = 'reschedule_consultation_meeting';
function fn(text, name) {
    const matches = [...compact(text).matchAll(new RegExp(
        'create (?:or replace )?function public\\.' + name + '\\([\\s\\S]*?\\$\\$;', 'g'))];
    assert.equal(matches.length, 1, name);
    return matches[0][0];
}
function between(text, start, end) {
    const from = text.indexOf(start);
    const to = text.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, 'Missing boundaries: ' + start + ' / ' + end);
    return text.slice(from, to);
}
function ordered(text, ...parts) {
    let last = -1;
    for (const part of parts) {
        const next = text.indexOf(part, last + 1);
        assert.ok(next > last, 'Missing or unordered: ' + part);
        last = next;
    }
}
function replaceOnce(text, from, to) {
    assert.equal(text.split(from).length, 2, 'Unique replacement: ' + from);
    return text.replace(from, to);
}
const publishedCreate = fn(await read('20261020120000_meeting_outcome_workflow.sql'), createName);
const publishedReschedule = fn(await read('20261013211621_reschedule_meeting_workflow.sql'), rescheduleName);
const equality = 'v_schedule_changed := v_old.scheduled_at is distinct from v_scheduled_at or v_old.time_zone is distinct from p_time_zone or v_old.duration_minutes is distinct from p_duration_minutes or v_old.mode is distinct from p_mode;';
const revisionGuard = "if v_schedule_changed and v_old.schedule_revision = 2147483647 then raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR'; end if;";
const revisionSet = 'schedule_revision = case when v_schedule_changed then schedule_revision + 1 else schedule_revision end';
const checks = [];
function contract(name, check) {
    checks.push(check);
    test('schedule context: ' + name, () => check(source));
}
contract('transaction, exactly two replacements, exact signatures and backend-only permissions', text => {
    const signatures = [
        [createName, 'uuid, uuid, uuid, text, date, time without time zone, text, integer, text, uuid, text'],
        [rescheduleName, 'uuid, uuid, uuid, text, integer, date, time without time zone, text, integer, text'],
    ];
    let outer = compact(text);
    for (const [name] of signatures) {
        const body = fn(text, name);
        assert.ok(body.startsWith('create or replace function '));
        assert.ok(body.includes("returns jsonb language plpgsql volatile security invoker set search_path = pg_catalog, pg_temp set timezone = 'UTC' as $$"));
        outer = replaceOnce(outer, body, 'FUNCTION;');
    }
    const permissions = signatures.map(([name, args]) => `FUNCTION;
        revoke all privileges on function public.${name}(${args}) from public, anon, authenticated, service_role;
        grant execute on function public.${name}(${args}) to service_role;`).join(' ');
    assert.equal(norm(outer), norm('BEGIN; ' + permissions + ' COMMIT;'));
});
contract('CREATE equals the effective post-outcome definition except the four inserted columns', text => {
    let body = fn(text, createName);
    body = replaceOnce(body, ', booked_by, role_at_booking, booking_attribution_source, schedule_revision', '');
    body = replaceOnce(body, ", p_actor_id, v_actor.role, 'explicit', 1", '');
    assert.equal(body, publishedCreate);
});
contract('RESCHEDULE equals its published definition except declaration, comparison, guard and revision SET', text => {
    let body = fn(text, rescheduleName);
    body = replaceOnce(body, 'create or replace function', 'create function');
    body = replaceOnce(body, ' v_schedule_changed boolean;', '');
    body = replaceOnce(body, equality + ' ' + revisionGuard + ' ', '');
    body = replaceOnce(body, ', ' + revisionSet, '');
    assert.equal(body, publishedReschedule);
});
contract('CREATE column/value mapping attributes the locked actor and preserves assignment', text => {
    const body = fn(text, createName);
    const insert = body.match(/insert into public\.meetings \(([^)]*)\) values \(([^)]*)\) returning \* into v_meeting;/);
    assert.ok(insert);
    const columns = insert[1].split(',').map(x => x.trim());
    const values = insert[2].split(',').map(x => x.trim());
    assert.equal(columns.length, 15);
    assert.equal(new Set(columns).size, columns.length);
    assert.equal(values.length, columns.length);
    assert.deepEqual(Object.fromEntries(columns.map((c, i) => [c, values[i]])), {
        consultation_request_id: 'v_request.id', scheduled_at: 'v_scheduled_at', time_zone: 'p_time_zone',
        duration_minutes: 'p_duration_minutes', mode: 'p_mode', status: "'scheduled'", notes: 'p_notes',
        assigned_to: 'p_assigned_to', created_by: 'p_actor_id', updated_by: 'p_actor_id', version: '1',
        booked_by: 'p_actor_id', role_at_booking: 'v_actor.role', booking_attribution_source: "'explicit'", schedule_revision: '1',
    });
    assert.doesNotMatch(body.slice(0, body.indexOf('returns jsonb')), /booked_by|role_at_booking|attribution|revision/);
});
contract('exact null-safe logistics equality includes textual zone, excludes notes and assignment', text => {
    const body = fn(text, rescheduleName);
    const comparison = body.match(/v_schedule_changed := [^;]+;/g);
    assert.deepEqual(comparison, [equality]);
});
contract('exact SET preserves attribution, notes and assignment; option B always increments version', text => {
    const body = fn(text, rescheduleName);
    assert.equal(between(body, 'update public.meetings set', 'where id = v_old.id'),
        'update public.meetings set scheduled_at = v_scheduled_at, time_zone = p_time_zone, duration_minutes = p_duration_minutes, mode = p_mode, updated_by = p_actor_id, updated_at = clock_timestamp(), version = version + 1, ' + revisionSet + ' ');
    const tail = body.slice(body.indexOf(equality));
    assert.equal((tail.match(/return v_response;/g) || []).length, 1);
    ordered(tail, revisionGuard, 'begin update public.meetings set',
        'insert into public.audit_events', "'meeting_rescheduled'", 'insert into public.idempotency_records', 'return v_response;');
});
contract('overflow follows CAS and temporal checks; identical logistics bypasses only revision overflow', text => {
    const body = fn(text, rescheduleName);
    ordered(body, 'return v_response;', 'v_old.version is distinct from p_expected_version',
        "v_request.status is distinct from 'converted'", 'if v_old.version = 2147483647 then',
        'from pg_catalog.pg_timezone_names', 'v_scheduled_at :=',
        'if (v_scheduled_at at time zone p_time_zone) <> v_local_time then',
        'if v_scheduled_at <= now() or v_scheduled_at <= clock_timestamp() then',
        equality, revisionGuard, 'update public.meetings set');
    assert.equal((body.match(/v_old\.schedule_revision/g) || []).length, 1);
    assert.equal((body.match(/v_schedule_changed/g) || []).length, 4);
});
contract('CREATE lock order keeps actor and assignee SHARE before parent UPDATE and INSERT', text => {
    const body = fn(text, createName);
    ordered(body, 'pg_advisory_xact_lock', 'where u.id = p_actor_id for share;',
        'select r.* into v_previous', 'return v_previous.response_payload;',
        'where u.id = p_assigned_to for share;', 'where r.id = p_consultation_request_id for update;', 'insert into public.meetings');
});
contract('RESCHEDULE lock order and closed replay precede mutable reads and revision handling', text => {
    const body = fn(text, rescheduleName);
    ordered(body, 'pg_advisory_xact_lock', 'where u.id = p_actor_id for share;',
        'select r.* into v_previous', 'return v_response;', 'select m.consultation_request_id',
        'where r.id = v_parent_id for update;', 'where m.id = p_meeting_id for update;', equality);
    const replay = between(body, 'select r.* into v_previous', 'if p_expected_version');
    assert.equal(replay, between(publishedReschedule, 'select r.* into v_previous', 'if p_expected_version'));
    assert.doesNotMatch(replay, /public\.meetings|public\.consultation_requests|insert into|update public|delete from/);
});
for (const [name, baseline, keys] of [
    [createName, publishedCreate, ['consultation', 'id', 'status', 'updatedAt', 'meeting', 'id', 'consultationRequestId', 'scheduledAt', 'timeZone', 'durationMinutes', 'mode', 'status', 'assignedTo', 'createdBy', 'updatedBy', 'version', 'createdAt', 'updatedAt']],
    [rescheduleName, publishedReschedule, ['id', 'consultationRequestId', 'scheduledAt', 'timeZone', 'durationMinutes', 'mode', 'status', 'version']],
]) {
    contract(name + ' exact response and audit/idempotency tail', text => {
        const body = fn(text, name);
        const response = between(body, 'v_response := jsonb_build_object(', 'insert into public.idempotency_records');
        assert.deepEqual([...response.matchAll(/'([^']*)'/g)].map(x => x[1]), keys);
        const auditStart = name === createName ? "if v_request.status = 'pending' then" : 'insert into public.audit_events';
        assert.equal(body.slice(body.indexOf(auditStart)), baseline.slice(baseline.indexOf(auditStart)));
    });
}

const hashes = {
    '20261007040229_create_meetings_workflow.sql': '0c7ce5f4cb4fe055dbb5397c8c9f7726461b38ae2cc4429d228a13f3ad65a982',
    '20261013211621_reschedule_meeting_workflow.sql': '2920caa51a16f8298c5b37a462f46c95d35dea45bfbb177cc24ccec0acbc44fd',
    '20261015120000_cancel_meeting_workflow.sql': '809f11f07b0dcda0dfd4d347c51cb1881aab329d57d69f6b47b5f9f0f88fcf52',
    '20261020120000_meeting_outcome_workflow.sql': 'c3ce6e84ee0d8a0e27464df306e38863968ab95e655bc393c717988221527be1',
    '20261022010000_meeting_context_schema.sql': 'ff99ad718ac4ffa221aa5087262192bd4e9d8c25550fd51fecdf143760551b58',
    '20261022020000_meeting_context_workflows.sql': 'd08db02e55e2fca3861b9459c994e85ff793932c8bb9a9a2fb8e18d68e434160',
};
for (const [file, expected] of Object.entries(hashes)) {
    test('published migration unchanged: ' + file, async () => {
        assert.equal(createHash('sha256').update((await read(file)).replace(/\r\n/g, '\n')).digest('hex'), expected);
    });
}

// Each mutant must be real and rejected by the same validators used on the migration.
const mutations = [
    ['literal whitespace in isolation guard', "'read committed'", "'read  committed'", true],
    ['OR true in scheduled guard', 'if v_has_scheduled then', 'if v_has_scheduled or true then'],
    ['invert actor NOT IN', "v_actor.role not in ('admin', 'agendadora')", "v_actor.role in ('admin', 'agendadora')", true],
    ['mutable read during replay', 'return v_previous.response_payload;', 'perform 1 from public.meetings; return v_previous.response_payload;'],
    ['caller booked_by', ", p_actor_id, v_actor.role, 'explicit', 1", ", p_booked_by, v_actor.role, 'explicit', 1"],
    ['caller role', "v_actor.role, 'explicit', 1", "p_role_at_booking, 'explicit', 1"],
    ['caller source', "v_actor.role, 'explicit', 1", 'v_actor.role, p_source, 1'],
    ['non-explicit source', "v_actor.role, 'explicit', 1", "v_actor.role, 'unknown', 1"],
    ['hardcoded role', "v_actor.role, 'explicit', 1", "'admin', 'explicit', 1"],
    ['overwrite attribution', 'update public.meetings set', 'update public.meetings set booked_by = p_actor_id,'],
    ['unconditional revision', revisionSet, 'schedule_revision = schedule_revision + 1'],
    ['never increment revision', revisionSet, 'schedule_revision = schedule_revision'],
    ['increment revision on no-op', 'else schedule_revision end', 'else schedule_revision + 1 end'],
    ['omit textual zone', ' or v_old.time_zone is distinct from p_time_zone', ''],
    ['include notes', equality, equality.replace(';', ' or v_old.notes is distinct from p_notes;')],
    ['include assignment', equality, equality.replace(';', ' or v_old.assigned_to is distinct from p_assigned_to;')],
    ['expand response', "'status', v_meeting.status, 'version', v_meeting.version", "'status', v_meeting.status, 'version', v_meeting.version, 'scheduleRevision', v_meeting.schedule_revision"],
    ['alter audit metadata', "'previousVersion', v_old.version", "'previousVersion', v_meeting.version"],
    ['rename operation', "v_operation constant text := 'reschedule_consultation_meeting'", "v_operation constant text := 'reschedule_v2'"],
    ['early no-op return', equality, equality + ' if not v_schedule_changed then return v_response; end if;'],
    ['reject identical INT_MAX revision', 'if v_schedule_changed and v_old.schedule_revision', 'if v_old.schedule_revision'],
    ['remove revision overflow', revisionGuard, ''],
    ['definer security', 'security invoker', 'security definer', true],
    ['expand grants', ') to service_role;', ') to service_role, authenticated;', true],
];
for (const [name, from, to, multiple] of mutations) {
    test('reject mutation: ' + name, () => {
        const original = compact(source);
        const mutated = multiple ? original.replaceAll(from, to) : replaceOnce(original, from, to);
        assert.notEqual(mutated, original);
        assert.throws(() => checks.forEach(check => check(mutated)), assert.AssertionError);
    });
}
test('reject mutation: meeting lock before parent lock', () => {
    const original = compact(source);
    const parent = 'select r.* into v_request from public.consultation_requests r where r.id = v_parent_id for update;';
    const meeting = 'select m.* into v_old from public.meetings m where m.id = p_meeting_id for update;';
    let mutated = replaceOnce(original, parent, 'LOCK_PLACEHOLDER');
    mutated = replaceOnce(mutated, meeting, parent);
    mutated = replaceOnce(mutated, 'LOCK_PLACEHOLDER', meeting);
    assert.throws(() => checks.forEach(check => check(mutated)), assert.AssertionError);
});
test('reject mutation: restore historical prohibition after completed', async () => {
    let old = fn(await read('20261007040229_create_meetings_workflow.sql'), createName);
    old = old.replace('create function', 'create or replace function');
    // Give the obsolete implementation the correct new INSERT: it must still fail.
    const current = fn(source, createName);
    const insert = body => between(body, 'insert into public.meetings', 'exception when unique_violation');
    old = replaceOnce(old, insert(old), insert(current));
    const mutated = replaceOnce(compact(source), current, old);
    assert.throws(() => checks.forEach(check => check(mutated)), assert.AssertionError);
});
