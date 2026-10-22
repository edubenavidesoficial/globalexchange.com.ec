import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Static SQL contracts only: these tests do not compile or execute PostgreSQL.
const source = await readFile(new URL(
    '../supabase/migrations/20261022010000_meeting_context_schema.sql', import.meta.url
), 'utf8');
const compact = text => text.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const normalize = text => compact(text).replace(/\s*([(),;])\s*/g, '$1');
const sql = compact(source);

// Split this migration's statements while preserving quoted strings and dollar bodies.
// Reject unrecognized tails instead of silently ignoring extra SQL.
function statements(text) {
    const tokens = compact(text).match(/\$([a-z_][a-z_0-9]*)\$[\s\S]*?\$\1\$|'(?:''|[^'])*'|[^'$;]+|;/gi) || [];
    assert.equal(tokens.join(''), compact(text), 'Every SQL character must be accounted for');
    const result = [];
    let pending = '';
    for (const token of tokens) {
        pending += token;
        if (token === ';') {
            result.push(normalize(pending));
            pending = '';
        }
    }
    assert.equal(pending.trim(), '', 'No unterminated SQL');
    return result;
}
const commands = statements(source);
function exactStatement(expected, text = source) {
    assert.equal(statements(text).filter(s => s === normalize(expected)).length, 1, expected);
}
const encoding = `DO $encoding$ BEGIN
    IF pg_catalog.current_setting('server_encoding') <> 'UTF8' THEN
        RAISE EXCEPTION 'meeting_context_schema requires server_encoding UTF8';
    END IF; END; $encoding$;`;
const helper = `CREATE FUNCTION public.utf16_length(p_value text)
    RETURNS bigint LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE SECURITY INVOKER
    SET search_path = pg_catalog, pg_temp AS $utf16$
    SELECT COALESCE(pg_catalog.sum(
        CASE WHEN pg_catalog.ascii(code_point) > 65535 THEN 2 ELSE 1 END
    ), 0::bigint)
    FROM pg_catalog.regexp_split_to_table(p_value, '') AS characters(code_point)
    WHERE code_point <> ''; $utf16$;`;
const columns = [
    ['booked_by', 'uuid NULL'],
    ['role_at_booking', 'text NULL'],
    ['booking_attribution_source', "text NOT NULL DEFAULT 'unknown'"],
    ['schedule_revision', 'integer NOT NULL DEFAULT 1'],
];
const constraints = [
    ['meetings_booked_by_fkey', `FOREIGN KEY (booked_by) REFERENCES public.internal_users(id)
        ON DELETE RESTRICT ON UPDATE NO ACTION`],
    ['meetings_role_at_booking_valid', "CHECK (role_at_booking IS NULL OR role_at_booking IN ('admin', 'agendadora'))"],
    ['meetings_booking_attribution_source_valid', `CHECK (booking_attribution_source IN
        ('unknown', 'explicit', 'verified_backfill', 'administrative_correction'))`],
    ['meetings_booking_attribution_consistent', `CHECK (
        (booking_attribution_source = 'unknown' AND booked_by IS NULL AND role_at_booking IS NULL)
        OR (booking_attribution_source IN ('explicit', 'verified_backfill', 'administrative_correction')
            AND booked_by IS NOT NULL AND role_at_booking IS NOT NULL))`],
    ['meetings_schedule_revision_positive', 'CHECK (schedule_revision > 0)'],
    ['meetings_notes_utf16_length_valid', 'CHECK (notes IS NULL OR public.utf16_length(notes) <= 2000)'],
];
const permissions = [
    'REVOKE ALL PRIVILEGES ON FUNCTION public.utf16_length(text) FROM public, anon, authenticated, service_role;',
    'GRANT EXECUTE ON FUNCTION public.utf16_length(text) TO service_role;',
];
const index = `CREATE INDEX meetings_booked_by_scheduled_at_idx
    ON public.meetings USING btree (booked_by, scheduled_at);`;
const expected = ['BEGIN;', encoding, helper, ...permissions,
    ...columns.map(([name, definition]) => `ALTER TABLE public.meetings ADD COLUMN ${name} ${definition};`),
    ...constraints.map(([name, definition]) => `ALTER TABLE public.meetings ADD CONSTRAINT ${name} ${definition};`),
    index, 'COMMIT;'];

test('context: existing migration is atomic, ordered and limited to approved statements', () => {
    assert.deepEqual(commands, expected.map(normalize));
});
test('context: UTF8 is required before installing the helper, with an explicit failure', () => {
    exactStatement(encoding);
    assert.equal(commands[1], normalize(encoding));
    assert.equal(commands[2], normalize(helper));
});
test('context: exact deterministic UTF16 helper, signature, attributes and closed search_path', () => {
    exactStatement(helper);
    assert.doesNotMatch(sql, /SECURITY DEFINER|octet_length|char_length|convert_to|normalize\s*\(/i);
});
test('context: backend CHECK execution allowed; PUBLIC and browser roles revoked', () => {
    assert.deepEqual(commands.filter(s => /^(?:GRANT|REVOKE)\b/i.test(s)), permissions.map(normalize));
});
for (const [name, definition] of columns) {
    test(`context: exact column ${name}, nullability and default`, () => {
        exactStatement(`ALTER TABLE public.meetings ADD COLUMN ${name} ${definition};`);
    });
}
for (const [name, definition] of constraints) {
    test(`context: complete validated constraint ${name}`, () => {
        exactStatement(`ALTER TABLE public.meetings ADD CONSTRAINT ${name} ${definition};`);
    });
}
test('context: exact nonunique B-tree index and key order', () => exactStatement(index));
test('context: no data changes, new workflows, RLS changes, drift masking or deferred validation', () => {
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\s+(?:INTO\s+|FROM\s+)?public\./i);
    assert.doesNotMatch(sql, /\b(?:TRIGGER|POLICY|ENUM)\b|\bCREATE TABLE\b|\bALTER FUNCTION\b|\bDROP\b|\bEXECUTE\s+(?:format\b|')|\bNOT VALID\b|\bIF NOT EXISTS\b|\bOR REPLACE\b|\bROW LEVEL SECURITY\b/i);
    assert.doesNotMatch(sql, /created_by|audit_events|idempotency_records|consultation_meeting|canonicalize_meeting_notes|update_meeting_notes|correct_meeting_booking_attribution/i);
    assert.equal(commands.filter(s => /^CREATE FUNCTION\b/i.test(s)).length, 1);
});
test('context: contract rejects permissive checks, missing NULL guards and incorrect lengths', () => {
    for (const [before, after] of [
        ["'admin', 'agendadora'", "'admin', 'agendadora', 'vendedora'"],
        ['AND booked_by IS NOT NULL', 'AND TRUE'],
        ['AND role_at_booking IS NOT NULL', 'AND TRUE'],
        ['schedule_revision > 0', 'schedule_revision >= 0'],
        ['<= 2000', '<= 2001'],
        ['> 65535 THEN 2', '> 65535 THEN 1'],
        ["WHERE code_point <> ''", 'WHERE TRUE'],
    ]) {
        const mutant = source.replace(before, after);
        assert.notEqual(mutant, source);
        assert.throws(() => assert.deepEqual(statements(mutant), expected.map(normalize)), { code: 'ERR_ASSERTION' });
    }
});
test('context: contract rejects additional SQL, browser grants and duplicate objects', () => {
    for (const extra of [
        'GRANT EXECUTE ON FUNCTION public.utf16_length(text) TO authenticated;',
        'UPDATE public.meetings SET booked_by = created_by;',
        index,
    ]) {
        assert.throws(() => assert.deepEqual(statements(source.replace('COMMIT;', `${extra}\nCOMMIT;`)),
            expected.map(normalize)), { code: 'ERR_ASSERTION' });
    }
});

// Fixtures for a future local PostgreSQL harness after applying the migrations:
// SELECT input, expected, public.utf16_length(input) AS actual
// FROM (VALUES (NULL::text, NULL::bigint), ('', 0), ('abc', 3),
//   (U&'\00E1', 1), (U&'a\0301', 2), (U&'\263A', 1), (U&'\+01F600', 2),
//   (repeat(U&'\+01F600', 1000), 2000), (repeat(U&'\+01F600', 1001), 2002)
// ) AS fixtures(input, expected)
// WHERE public.utf16_length(input) IS DISTINCT FROM expected;
// Require zero rows. Run CHECK boundary/NULL tests under service_role in a rollback
// transaction with local parent fixtures. Test U+0000 and invalid UTF8 as rejected
// input at the PostgreSQL text boundary, not as rows accepted by a synthetic CHECK.
// The JavaScript tests below validate fixture expectations, NOT SQL execution.
for (const [label, value, expectedLength] of [
    ['NULL', null, null], ['empty', '', 0], ['ASCII', 'abc', 3],
    ['precomposed', '\u00e1', 1], ['combining', 'a\u0301', 2],
    ['BMP symbol', '\u263a', 1], ['supplementary', '\u{1f600}', 2],
    ['1000 supplementary', '\u{1f600}'.repeat(1000), 2000],
    ['1001 supplementary', '\u{1f600}'.repeat(1001), 2002],
]) {
    test(`context fixture oracle (JavaScript only): ${label}`, () => {
        assert.equal(value === null ? null : value.length, expectedLength);
        const counted = value === null ? null : [...value].reduce(
            (total, point) => total + (point.codePointAt(0) > 65535 ? 2 : 1), 0);
        assert.equal(counted, expectedLength);
    });
}
