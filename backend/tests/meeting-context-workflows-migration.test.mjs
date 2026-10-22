import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Static contracts and JavaScript oracles only: no PostgreSQL, credentials or network.
// These tests do not establish SQL compilation, concurrency or transactional rollback.
const read = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const source = await read('20261022020000_meeting_context_workflows.sql');
const compact = text => text.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const norm = text => compact(text).replace(/\s*([(),;])\s*/g, '$1');
const quoted = text => [...text.matchAll(/'([^']*)'/g)].map(m => m[1]);
const fail = code => "raise exception using errcode = 'P0001', message = '" + code + "';";
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
function fn(text, name) {
    const matches = [...compact(text).matchAll(new RegExp(
        'create function public\\.' + name + '\\([\\s\\S]*?\\$\\$;', 'g'))];
    assert.equal(matches.length, 1, name);
    return matches[0][0];
}
const notes = text => fn(text, 'update_meeting_notes');
const attribution = text => fn(text, 'correct_meeting_booking_attribution');
const replay = text => between(attribution(text), 'select r.* into v_previous', 'select u.* into v_target');
function has(text, expected) {
    assert.ok(norm(text).includes(norm(expected)), 'Missing complete contract: ' + expected);
}
const contracts = [];
function contract(name, verify) {
    contracts.push(verify);
    test('context workflows: ' + name, () => verify(source));
}
const signatures = [
    ['canonicalize_meeting_notes', 'p_value text', 'text',
        'language sql immutable strict parallel safe security invoker set search_path = pg_catalog, pg_temp', 'text'],
    ['update_meeting_notes', 'p_actor_id uuid, p_meeting_id uuid, p_expected_version integer, p_notes text, p_reason text',
        'jsonb', "language plpgsql volatile security invoker set search_path = pg_catalog, pg_temp set timezone = 'UTC'",
        'uuid, uuid, integer, text, text'],
    ['correct_meeting_booking_attribution',
        'p_actor_id uuid, p_meeting_id uuid, p_idempotency_key uuid, p_request_hash text, p_expected_version integer, p_booked_by uuid, p_role_at_booking text, p_reason text',
        'jsonb', "language plpgsql volatile security invoker set search_path = pg_catalog, pg_temp set timezone = 'UTC'",
        'uuid, uuid, uuid, text, integer, uuid, text, text'],
];
const auditCheck = "check ((entity_type = 'consultation_request' and action = 'consultation_converted') or (entity_type = 'meeting' and action in ('meeting_created', 'meeting_rescheduled', 'meeting_cancelled', 'meeting_completed', 'meeting_no_show', 'meeting_notes_updated', 'meeting_booking_attribution_corrected')))";
const operationsCheck = "check (operation in ('create_consultation_meeting', 'reschedule_consultation_meeting', 'cancel_consultation_meeting', 'complete_consultation_meeting', 'mark_consultation_meeting_no_show', 'correct_meeting_booking_attribution'))";
function constraint(text, table, name, expected) {
    const matches = [...compact(text).matchAll(new RegExp(
        'alter table public\\.' + table + ' add constraint ' + name + ' ([^;]+);', 'g'))];
    assert.equal(matches.length, 1);
    assert.equal(norm(matches[0][1]), norm(expected));
}
contract('exact outer transaction and statement inventory, no out-of-scope DDL/DML', text => {
    let outer = compact(text);
    assert.deepEqual([...outer.matchAll(/create function public\.(\w+)\(/g)].map(m => m[1]), signatures.map(s => s[0]));
    for (const [name] of signatures) outer = outer.replace(fn(text, name), 'FUNCTION_' + name + ';');
    const expected = ['BEGIN;', 'FUNCTION_canonicalize_meeting_notes;'];
    const permissions = (name, args) => [
        'revoke all privileges on function public.' + name + '(' + args + ') from public, anon, authenticated, service_role;',
        'grant execute on function public.' + name + '(' + args + ') to service_role;',
    ];
    expected.push(...permissions(signatures[0][0], signatures[0][4]));
    for (const [table, name, check] of [
        ['audit_events', 'audit_events_entity_action_valid', auditCheck],
        ['idempotency_records', 'idempotency_records_operation_valid', operationsCheck],
    ]) expected.push('alter table public.' + table + ' drop constraint ' + name + ';',
        'alter table public.' + table + ' add constraint ' + name + ' ' + check + ';');
    for (const [name, , , , args] of signatures.slice(1)) {
        expected.push('FUNCTION_' + name + ';', ...permissions(name, args));
    }
    expected.push('COMMIT;');
    assert.equal(norm(outer), norm(expected.join(' ')));
    assert.doesNotMatch(compact(text), /security definer|if not exists|create or replace|when others|create trigger|create extension|\bexecute\s+(?:format|')|\b(?:delete|truncate)\b|not valid/i);
});
for (const [name, args, returns, attributes, types] of signatures) {
    contract(name + ': exact signature, attributes and backend-only grants', text => {
        const definition = fn(text, name);
        assert.equal(norm(definition.slice(0, definition.indexOf('as $$'))),
            norm('create function public.' + name + '(' + args + ') returns ' + returns + ' ' + attributes));
        has(text, 'revoke all privileges on function public.' + name + '(' + types + ') from public, anon, authenticated, service_role;');
        has(text, 'grant execute on function public.' + name + '(' + types + ') to service_role;');
    });
}
const trimPoints = [9, 10, 11, 12, 13, 32, 160, 5760,
    ...Array.from({ length: 11 }, (_, i) => 8192 + i), 8232, 8233, 8239, 8287, 12288, 65279];
contract('canonicalizer exact btrim set, NULLIF, no normalization or approximate regex', text => {
    const helper = fn(text, 'canonicalize_meeting_notes');
    const escapes = trimPoints.map(n => '\\' + n.toString(16).toUpperCase().padStart(4, '0')).join('');
    assert.equal(norm(between(helper, 'as $$', '$$;')),
        norm("as $$ select nullif(pg_catalog.btrim(p_value, U&'" + escapes + "'), '');"));
    assert.doesNotMatch(helper, /0085|200B|normalize|regexp/i);
});
test('canonicalizer JavaScript oracle: exact whitespace set, internal whitespace and preserved code points', () => {
    // Independent JS oracle; does not execute the SQL btrim expression.
    for (const cp of trimPoints) {
        const ch = String.fromCodePoint(cp);
        assert.equal((ch + 'x' + ch).trim(), 'x');
        assert.equal(('x' + ch + 'y').trim(), 'x' + ch + 'y');
        assert.equal(ch.trim() || null, null);
    }
    for (const cp of [0x85, 0x200b, 0x180e]) {
        const value = String.fromCodePoint(cp) + 'x' + String.fromCodePoint(cp);
        assert.equal(value.trim(), value);
    }
    assert.equal(' a\u0301 '.trim(), 'a\u0301');
    assert.equal(' á '.trim(), 'á');
});
contract('audit exact entity/action pairs preserve all old actions and add only two', text =>
    constraint(text, 'audit_events', 'audit_events_entity_action_valid', auditCheck));
contract('idempotency exact six operations; no operation for notes', text =>
    constraint(text, 'idempotency_records', 'idempotency_records_operation_valid', operationsCheck));

for (const [name] of signatures.slice(1)) {
    contract(name + ': isolation and structural actor/version validation', text => {
        const f = fn(text, name);
        has(f, "if current_setting('transaction_isolation') <> 'read committed' then " + fail('WORKFLOW_ISOLATION_NOT_SUPPORTED') + ' end if;');
        has(f, 'if p_actor_id is null then ' + fail('ACTOR_NOT_ALLOWED') + ' end if;');
        has(f, 'if p_expected_version is null or p_expected_version <= 0 then ' + fail('INVALID_MEETING_INPUT') + ' end if;');
        ordered(f, "current_setting('transaction_isolation')", 'if p_actor_id is null',
            'if p_expected_version is null', 'select u.* into v_actor');
    });
    contract(name + ': parent before meeting locks with post-lock identity/status checks', text => {
        const f = fn(text, name);
        const expected = "select m.consultation_request_id into v_parent_id from public.meetings m where m.id = p_meeting_id; if not found then " + fail('MEETING_NOT_FOUND')
            + " end if; select r.* into v_request from public.consultation_requests r where r.id = v_parent_id for update; if not found then " + fail('CONSULTATION_STATE_INCONSISTENT')
            + " end if; select m.* into v_old from public.meetings m where m.id = p_meeting_id for update; if not found then " + fail('MEETING_NOT_FOUND')
            + " end if; if v_old.id is distinct from p_meeting_id or v_old.consultation_request_id is distinct from v_parent_id or v_request.status is distinct from 'converted' then "
            + fail('CONSULTATION_STATE_INCONSISTENT') + ' end if;';
        has(f, expected);
        assert.equal((f.match(/for update/g) || []).length, 2);
        ordered(f, 'where u.id = p_actor_id for share;', 'select m.consultation_request_id',
            'select r.* into v_request', 'select m.* into v_old', 'if v_old.version is distinct from p_expected_version');
    });
    contract(name + ': CAS before no-op, overflow only inside change, audit only inside change', text => {
        const f = fn(text, name);
        has(f, 'if v_old.version is distinct from p_expected_version then ' + fail('MEETING_VERSION_CONFLICT') + ' end if;');
        has(f, 'v_meeting := v_old; if v_changed then if v_old.version = 2147483647 then ' + fail('INTERNAL_ERROR') + ' end if; update public.meetings set');
        ordered(f, 'if v_old.version is distinct from p_expected_version', 'v_changed :=', 'v_meeting := v_old;',
            'if v_changed then', 'if v_old.version = 2147483647', 'update public.meetings set', 'insert into public.audit_events');
        assert.equal((f.match(/if v_changed then/g) || []).length, 1);
        assert.equal((f.match(/insert into public.audit_events/g) || []).length, 1);
        has(f, 'where id = v_old.id returning * into v_meeting; if not found then ' + fail('MEETING_NOT_FOUND') + ' end if;');
        assert.doesNotMatch(f, /\b(?:commit|rollback|delete|truncate)\b|\bupdate public\.(?!meetings\b)|insert into public\.meetings/i);
    });
}
contract('notes canonicalization then UTF16 length; NULL is valid and notes has no idempotency', text => {
    const f = notes(text);
    has(f, 'if p_meeting_id is null then ' + fail('INVALID_REQUEST') + ' end if;');
    has(f, 'v_notes := public.canonicalize_meeting_notes(p_notes); if public.utf16_length(v_notes) > 2000 then ' + fail('INVALID_MEETING_NOTES') + ' end if;');
    assert.doesNotMatch(f, /p_notes is null|idempotency|advisory|request_hash|\bstrict\b/i);
    assert.equal((f.match(/public.canonicalize_meeting_notes/g) || []).length, 1);
    assert.equal((f.match(/public.utf16_length/g) || []).length, 1);
});
contract('notes active actor admin/agendadora under SHARE', text => {
    has(notes(text), "select u.* into v_actor from public.internal_users u where u.id = p_actor_id for share; if not found or v_actor.active is distinct from true or v_actor.role not in ('admin', 'agendadora') then " + fail('ACTOR_NOT_ALLOWED') + ' end if;');
});
contract('notes scheduled NULL reason; terminal admin with closed reasons, before CAS/no-op', text => {
    const f = notes(text);
    assert.equal(norm(between(f, "if v_old.status = 'scheduled'", 'if v_old.version is distinct')),
        norm("if v_old.status = 'scheduled' then v_terminal := false; if p_reason is not null then "
            + fail('INVALID_CORRECTION_REASON') + " end if; elsif v_old.status in ('completed', 'cancelled', 'no_show') then v_terminal := true; if v_actor.role is distinct from 'admin' then "
            + fail('ACTOR_NOT_ALLOWED') + " end if; if p_reason is null or p_reason not in ('clerical_error', 'operational_clarification') then "
            + fail('INVALID_CORRECTION_REASON') + ' end if; else ' + fail('CONSULTATION_STATE_INCONSISTENT') + ' end if;'));
    has(f, 'v_changed := v_old.notes is distinct from v_notes; v_meeting := v_old;');
});
const notesUpdate = 'notes = v_notes, updated_by = p_actor_id, updated_at = clock_timestamp(), version = version + 1';
const attrUpdate = "booked_by = p_booked_by, role_at_booking = p_role_at_booking, booking_attribution_source = 'administrative_correction', updated_by = p_actor_id, updated_at = clock_timestamp(), version = version + 1";
for (const [name, definition] of [['update_meeting_notes', notesUpdate], ['correct_meeting_booking_attribution', attrUpdate]]) {
    contract(name + ': sole UPDATE exact fields, no schedule_revision or other data writes', text => {
        assert.deepEqual([...fn(text, name).matchAll(/\bupdate public\.(\w+) set (.*?) where /g)].map(m => [m[1], norm(m[2])]),
            [['meetings', norm(definition)]]);
    });
}
const notesAudit = "'previousVersion', v_old.version, 'newVersion', v_meeting.version, 'notePresentBefore', v_old.notes is not null, 'notePresentAfter', v_meeting.notes is not null, 'terminalCorrection', v_terminal, 'reason', p_reason";
const attrAudit = "'previousBookedBy', v_old.booked_by, 'newBookedBy', v_meeting.booked_by, 'previousRoleAtBooking', v_old.role_at_booking, 'newRoleAtBooking', v_meeting.role_at_booking, 'previousSource', v_old.booking_attribution_source, 'newSource', v_meeting.booking_attribution_source, 'previousVersion', v_old.version, 'newVersion', v_meeting.version, 'reason', p_reason";
for (const [name, action, metadata] of [
    ['update_meeting_notes', 'meeting_notes_updated', notesAudit],
    ['correct_meeting_booking_attribution', 'meeting_booking_attribution_corrected', attrAudit],
]) {
    contract(name + ': exact minimal audit, independent UUID, closes changed branch', text => {
        const f = fn(text, name);
        const audit = between(f, 'insert into public.audit_events', 'end if;');
        assert.equal(norm(audit), norm("insert into public.audit_events (actor_id, entity_type, entity_id, action, metadata, operation_id) values (p_actor_id, 'meeting', v_meeting.id, '" + action + "', jsonb_build_object(" + metadata + '), gen_random_uuid());'));
        assert.doesNotMatch(audit, /p_request_hash|p_idempotency_key|email|phone|full_name|p_notes/);
        has(f, audit + (name === 'update_meeting_notes'
            ? 'end if; return jsonb_build_object(' : 'end if; v_response := jsonb_build_object('));
    });
}
const notesResponse = "'id', v_meeting.id, 'consultationRequestId', v_meeting.consultation_request_id, 'notes', v_meeting.notes, 'version', v_meeting.version, 'scheduleRevision', v_meeting.schedule_revision, 'updatedAt', v_meeting.updated_at, 'changed', v_changed";
const attrResponse = "'id', v_meeting.id, 'consultationRequestId', v_meeting.consultation_request_id, 'bookedBy', v_meeting.booked_by, 'roleAtBooking', v_meeting.role_at_booking, 'bookingAttributionSource', v_meeting.booking_attribution_source, 'version', v_meeting.version, 'scheduleRevision', v_meeting.schedule_revision, 'updatedAt', v_meeting.updated_at, 'changed', v_changed";
contract('notes exact seven-field response from old or updated row', text => {
    const f = notes(text);
    assert.equal(norm(f.slice(f.indexOf('return jsonb_build_object'))),
        norm('return jsonb_build_object(' + notesResponse + '); end; $$;'));
    assert.equal((f.match(/\breturn\b/g) || []).length, 1);
});
contract('attribution closed structural input; hash opaque; no configurable source', text => {
    const f = attribution(text);
    has(f, 'if p_meeting_id is null or p_idempotency_key is null or p_request_hash is null or length(trim(p_request_hash)) = 0 then ' + fail('INVALID_REQUEST') + ' end if;');
    has(f, 'if p_booked_by is null then ' + fail('BOOKING_ATTRIBUTION_TARGET_NOT_ELIGIBLE') + ' end if;');
    has(f, "if p_role_at_booking is null or p_role_at_booking not in ('admin', 'agendadora') then " + fail('BOOKING_ATTRIBUTION_ROLE_MISMATCH') + ' end if;');
    has(f, "if p_reason is null or p_reason not in ('wrong_person', 'missing_attribution', 'verified_information') then " + fail('INVALID_CORRECTION_REASON') + ' end if;');
    assert.doesNotMatch(f, /p_source|p_booking_attribution_source|digest\(|md5\(|p_request_hash\s*:=/);
});
contract('attribution one scoped advisory lock and active admin actor before replay', text => {
    const f = attribution(text);
    has(f, "v_operation constant text := 'correct_meeting_booking_attribution';");
    has(f, "perform pg_advisory_xact_lock(hashtextextended( v_operation || ':' || p_actor_id::text || ':' || p_idempotency_key::text, 0 ));");
    assert.equal((f.match(/pg_advisory_xact_lock/g) || []).length, 1);
    has(f, "select u.* into v_actor from public.internal_users u where u.id = p_actor_id for share; if not found or v_actor.active is distinct from true or v_actor.role is distinct from 'admin' then " + fail('ACTOR_NOT_ALLOWED') + ' end if;');
    ordered(f, 'pg_advisory_xact_lock', 'select u.* into v_actor', 'select r.* into v_previous');
});
contract('replay scope/hash; no mutable target/meeting reads, locks or CAS', text => {
    const r = replay(text);
    has(r, 'select r.* into v_previous from public.idempotency_records r where r.actor_id = p_actor_id and r.operation = v_operation and r.idempotency_key = p_idempotency_key; if found then if v_previous.request_hash is distinct from p_request_hash then ' + fail('IDEMPOTENCY_KEY_REUSED') + ' end if; v_response := v_previous.response_payload;');
    assert.doesNotMatch(r, /v_target|v_old|p_expected_version|from public\.(?:internal_users|meetings|consultation_requests)|for share|for update|\b(?:insert|update|delete)\b/);
    assert.ok(r.endsWith('return v_response; end if; '));
    ordered(attribution(text), 'return v_response;', 'select u.* into v_target', 'select m.consultation_request_id');
});
const attrFields = ['id', 'consultationRequestId', 'bookedBy', 'roleAtBooking', 'bookingAttributionSource', 'version', 'scheduleRevision', 'updatedAt', 'changed'];
contract('replay full nine-field shape, types, allowed role and fixed source', text => {
    const r = replay(text);
    const guard = between(r, "if jsonb_typeof(v_response)", "if (v_response->>'updatedAt')");
    const arrays = [...guard.matchAll(/array\[([^\]]+)\]/g)].map(m => quoted(m[1]));
    assert.deepEqual(arrays, [attrFields, attrFields]);
    const array = 'array[' + attrFields.map(k => "'" + k + "'").join(', ') + ']';
    let expected = "if jsonb_typeof(v_response) is distinct from 'object' or not (v_response ?& " + array
        + ") or (v_response - " + array + ") <> '{}'::jsonb";
    for (const key of attrFields) {
        const type = ['version', 'scheduleRevision'].includes(key) ? 'number' : key === 'changed' ? 'boolean' : 'string';
        expected += " or jsonb_typeof(v_response->'" + key + "') is distinct from '" + type + "'";
    }
    expected += " or coalesce(v_response->>'roleAtBooking', '') not in ('admin', 'agendadora') or (v_response->>'bookingAttributionSource') is distinct from 'administrative_correction' then "
        + fail('INTERNAL_ERROR') + ' end if;';
    assert.equal(norm(guard), norm(expected));
});
contract('replay finite ISO time, valid UUIDs, integer ranges and parent/meeting identity', text => {
    const r = replay(text);
    has(r, "if (v_response->>'updatedAt') !~ '^[0-9]{4,}-[0-9]{2}-[0-9]{2}T' then " + fail('INTERNAL_ERROR') + ' end if;');
    has(r, "if (v_response->>'consultationRequestId')::uuid is distinct from v_previous.consultation_request_id or not isfinite((v_response->>'updatedAt')::timestamptz) or (v_response->>'version')::integer <= 0 or (v_response->>'scheduleRevision')::integer <= 0 or ((v_response->>'changed')::boolean and (v_response->>'version')::integer < 2) then " + fail('INTERNAL_ERROR') + " end if; perform (v_response->>'bookedBy')::uuid; if (v_response->>'id')::uuid is distinct from p_meeting_id then " + fail('IDEMPOTENCY_KEY_REUSED') + ' end if;');
    ordered(r, "if (v_response->>'updatedAt') !~", 'begin if', 'exception when', 'return v_response;');
});
contract('only exception handler sanitizes replay casts; never catches writes or P0001', text => {
    const f = attribution(text);
    const handler = between(f, 'exception when', 'end;');
    assert.equal(norm(handler), norm('exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow or invalid_time_zone_displacement_value or invalid_parameter_value or config_file_error then ' + fail('INTERNAL_ERROR')));
    assert.equal((compact(text).match(/exception when/g) || []).length, 1);
    assert.ok(replay(text).includes(handler));
    assert.doesNotMatch(notes(text), /exception when/);
});
contract('new attribution target SHARE, active allowed role and exact role match', text => {
    const f = attribution(text);
    has(f, "select u.* into v_target from public.internal_users u where u.id = p_booked_by for share; if not found or v_target.active is distinct from true or v_target.role not in ('admin', 'agendadora') then " + fail('BOOKING_ATTRIBUTION_TARGET_NOT_ELIGIBLE') + ' end if; if v_target.role is distinct from p_role_at_booking then ' + fail('BOOKING_ATTRIBUTION_ROLE_MISMATCH') + ' end if;');
    ordered(f, 'return v_response;', 'where u.id = p_booked_by for share;', 'select m.consultation_request_id');
    assert.equal((f.match(/for share/g) || []).length, 2);
});
contract('attribution four states, full NULL-safe trio comparison; source-only change counts', text => {
    const f = attribution(text);
    has(f, "if v_old.status is null or v_old.status not in ('scheduled', 'completed', 'cancelled', 'no_show') then " + fail('CONSULTATION_STATE_INCONSISTENT') + ' end if;');
    has(f, "v_changed := v_old.booked_by is distinct from p_booked_by or v_old.role_at_booking is distinct from p_role_at_booking or v_old.booking_attribution_source is distinct from 'administrative_correction'; v_meeting := v_old;");
});
contract('attribution exact response and unconditional idempotency insert after changed branch', text => {
    const f = attribution(text);
    const tail = f.slice(f.indexOf('v_response := jsonb_build_object'));
    assert.equal(norm(tail), norm('v_response := jsonb_build_object(' + attrResponse + '); insert into public.idempotency_records (actor_id, operation, idempotency_key, request_hash, consultation_request_id, response_payload) values (p_actor_id, v_operation, p_idempotency_key, p_request_hash, v_parent_id, v_response); return v_response; end; $$;'));
    assert.equal((f.match(/insert into public.idempotency_records/g) || []).length, 1);
    assert.equal((f.match(/\breturn\b/g) || []).length, 2);
    assert.deepEqual([...f.matchAll(/insert into public\.(\w+)/g)].map(m => m[1]), ['audit_events', 'idempotency_records']);
});
test('context workflows: historical migrations and schema unchanged (normalized line endings)', async () => {
    for (const [file, hash] of [
        ['20261007040229_create_meetings_workflow.sql', '0c7ce5f4cb4fe055dbb5397c8c9f7726461b38ae2cc4429d228a13f3ad65a982'],
        ['20261013211621_reschedule_meeting_workflow.sql', '2920caa51a16f8298c5b37a462f46c95d35dea45bfbb177cc24ccec0acbc44fd'],
        ['20261015120000_cancel_meeting_workflow.sql', '809f11f07b0dcda0dfd4d347c51cb1881aab329d57d69f6b47b5f9f0f88fcf52'],
        ['20261020120000_meeting_outcome_workflow.sql', 'c3ce6e84ee0d8a0e27464df306e38863968ab95e655bc393c717988221527be1'],
        ['20261022010000_meeting_context_schema.sql', 'ff99ad718ac4ffa221aa5087262192bd4e9d8c25550fd51fecdf143760551b58'],
    ]) assert.equal(createHash('sha256').update((await read(file)).replaceAll('\r\n', '\n')).digest('hex'), hash, file);
});

// Mutate only in memory; the production migration and working tree are never changed.
for (const [label, before, after] of [
    ['open audit CHECK', "'meeting_booking_attribution_corrected'))", "'meeting_booking_attribution_corrected')) or true"],
    ['extra role', "v_actor.role not in ('admin', 'agendadora')", "v_actor.role not in ('admin', 'agendadora', 'vendedora')"],
    ['extra reason', "'clerical_error', 'operational_clarification'", "'clerical_error', 'operational_clarification', 'other'"],
    ['caller source', "booking_attribution_source = 'administrative_correction'", 'booking_attribution_source = p_source'],
    ['notes audit leak', "'notePresentAfter', v_meeting.notes is not null", "'notePresentAfter', v_meeting.notes"],
    ['hash audit leak', "'reason', p_reason", "'reason', p_request_hash"],
    ['key audit leak', "'reason', p_reason", "'reason', p_idempotency_key"],
    ['logistic increment', 'version = version + 1', 'version = version + 1, schedule_revision = schedule_revision + 1'],
    ['premature meeting lock', 'where m.id = p_meeting_id;', 'where m.id = p_meeting_id for update;'],
    ['definer', 'security invoker', 'security definer'],
    ['browser grant', 'to service_role;', 'to authenticated;'],
    ['legacy redefinition', 'COMMIT;', 'create or replace function public.cancel_consultation_meeting() returns void language sql as $$ select 1; $$; COMMIT;'],
    ['no CAS', 'if v_old.version is distinct from p_expected_version then', 'if false then'],
    ['ignore source in no-op', "or v_old.booking_attribution_source is distinct from 'administrative_correction'", 'or false'],
    ['notes length off by one', 'public.utf16_length(v_notes) > 2000', 'public.utf16_length(v_notes) > 2001'],
    ['target disabled allowed', 'v_target.active is distinct from true', 'false'],
    ['role mismatch ignored', 'if v_target.role is distinct from p_role_at_booking then', 'if false then'],
    ['replay payload changed', 'return v_response;', "return v_response || '{\"changed\":true}'::jsonb;"],
    ['extra operation', "'correct_meeting_booking_attribution')", "'correct_meeting_booking_attribution', 'update_meeting_notes')"],
    ['no-op overflow rejection', 'v_meeting := v_old;', "if v_old.version = 2147483647 then raise exception 'bad'; end if; v_meeting := v_old;"],
]) {
    test('context workflows negative: ' + label, () => {
        const mutant = source.replace(before, after);
        assert.notEqual(mutant, source, 'Mutation must change source');
        const rejected = contracts.some(verify => {
            try { verify(mutant); return false; }
            catch (error) {
                assert.equal(error.code, 'ERR_ASSERTION');
                return true;
            }
        });
        assert.ok(rejected, 'Contract validators must reject this mutation');
    });
}
