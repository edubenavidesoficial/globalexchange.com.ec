import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const key = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const payload = { date: '2028-02-29', time: '10:30', timeZone: 'America/Guayaquil',
    durationMinutes: 45, mode: 'online', assignedTo: id, notes: 'Nota sintética' };
const result = { consultation: { id }, meeting: { id: key } };
const A = { user: { id: 'A' }, access_token: 'synthetic-A' };
const B = { user: { id: 'B' }, access_token: 'synthetic-B' };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const clone = value => JSON.parse(JSON.stringify(value));
const agendaRow = { id, consultationRequestId: key, scheduledAt: '2026-10-01T10:00:00-05:00',
    timeZone: 'America/Guayaquil', durationMinutes: 45, mode: 'online', status: 'scheduled', version: 1,
    consultation: { id: key, fullName: 'Solicitante sintético', phone: '', email: null,
        program: { id, code: 'SYNTH', name: 'Programa sintético' } },
    assignedTo: { id, fullName: 'Persona sintética' } };
async function bounded(promise) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Still pending')), 1000); })]); }
    finally { clearTimeout(timer); }
}

// Módulos Auth y API reales; SDK/fetch simulados, sin config real ni .env.
async function fixture(options = {}) {
    const state = { session: A, reads: 0, active: 0, logout: 0, refresh: 0, requests: [],
        status: 201, response: { data: result }, current: true, ...options };
    const held = deferred();
    const release = deferred();
    let tail = Promise.resolve();
    const guard = new AbortController();
    const external = new AbortController();
    const realm = vm.createContext({ URLSearchParams, crypto: webcrypto, AbortController,
        AbortSignal: new Proxy(AbortSignal, { get: (target, property) => property === 'timeout' ? ms => {
            assert.equal(ms, 15000); return AbortSignal.timeout(options.shortTimeout ? 30 : ms);
        } : Reflect.get(target, property) }),
        fetch: async (url, request) => {
            state.requests.push({ url, ...request });
            if (state.holdFetch) { held.resolve(); await release.promise; }
            if (state.network) throw Error('PRIVATE_NETWORK');
            return { status: state.status, ok: state.status >= 200 && state.status < 300,
                async json() {
                    if (state.holdBody) { held.resolve(); await release.promise; }
                    if (state.badJSON) throw new SyntaxError('PRIVATE_JSON');
                    if (state.rawBody !== undefined) return JSON.parse(state.rawBody);
                    return state.response;
                } };
        },
    });
    const config = new vm.SyntheticModule(['getSupabaseClient', 'withAuthMutation', 'withAuthStorageLock'], function () {
        this.setExport('getSupabaseClient', () => ({ auth: {
            async getSession() {
                state.reads++;
                if (state.reads === state.holdRead) { held.resolve(); await release.promise; }
                return { data: { session: state.session } };
            },
            async signOut() { state.logout++; }, async refreshSession() { state.refresh++; },
        } }));
        const coordinate = action => {
            const pending = tail.then(async () => {
                state.active++;
                try { return await action(); } finally { state.active--; }
            });
            tail = pending.catch(() => {}); return pending;
        };
        this.setExport('withAuthMutation', coordinate);
        this.setExport('withAuthStorageLock', coordinate);
    }, { context: realm });
    const module = async name => new vm.SourceTextModule(await readFile(new URL(`../src/js/api/${name}.js`, import.meta.url), 'utf8'), { context: realm });
    const auth = await module('auth'); await auth.link(() => config);
    const internal = await module('internal'); await internal.link(() => auth);
    const meetings = await module('meetings'); await meetings.link(() => internal); await meetings.evaluate();
    const access = { session: A, signal: guard.signal, isCurrent: () => state.current,
        blockAccess() { assert.fail('API must not block CRM'); }, revalidate() { assert.fail('API must not control CRM'); } };
    return { state, access, external, guard, held: held.promise, release, auth: auth.namespace,
        api: meetings.namespace, internal: internal.namespace,
        query: expression => vm.runInContext(expression, realm),
        create: (overrides = {}) => meetings.namespace.createConsultationMeeting({
            consultationId: id, idempotencyKey: key, payload, access, signal: external.signal, ...overrides,
        }),
        get: query => internal.namespace.getInternal('/api/admin/consultations', access, external.signal, query),
        list: () => meetings.namespace.getAvailableSalespeople(access, external.signal),
        agenda: (overrides = {}) => meetings.namespace.getAgendaMeetings({
            from: '2026-10-01T00:00:00-05:00', to: '2026-10-02T00:00:00-05:00',
            access, signal: external.signal, ...overrides,
        }),
    };
}

test('GET previo sin query mantiene contrato y opciones', async () => {
    const f = await fixture({ status: 200, response: { data: [] } });
    assert.deepEqual(clone(await f.get()), { data: [] });
    const r = f.state.requests[0];
    assert.equal(r.url, '/api/admin/consultations'); assert.equal(r.method, 'GET');
    assert.equal(r.body, undefined); assert.deepEqual(clone(r.headers), { Authorization: 'Bearer synthetic-A' });
    assert.equal(r.cache, 'no-store'); assert.equal(r.credentials, 'omit'); assert.equal(r.redirect, 'error');
});
test('query codifica valores sin permitir inyección de parámetros', async () => {
    const f = await fixture(); await f.get(f.query("({ search: 'a&role=admin #?/á' })"));
    assert.equal(f.state.requests[0].url, '/api/admin/consultations?search=a%26role%3Dadmin+%23%3F%2F%C3%A1');
});
for (const path of ['/api/users?role=admin', 'https://evil.invalid/api/users', '//evil.invalid/api/users', '/api/users#x', '/api/users\n']) {
    test(`path inválido ${JSON.stringify(path)} sin fetch`, async () => {
        const f = await fixture();
        await assert.rejects(f.internal.getInternal(path, f.access, f.external.signal), { code: 'configuration' });
        assert.equal(f.state.requests.length, 0);
    });
}
for (const data of [[], [{ id, fullName: 'Persona sintética', role: 'vendedora', email: 'PRIVATE' }]]) {
    test('listado válido con filtros fijos y minimización', async () => {
        const f = await fixture({ status: 200, response: { data } });
        assert.deepEqual(clone(await f.list()), data.map(({ id, fullName, role }) => ({ id, fullName, role })));
        assert.equal(f.state.requests[0].url, '/api/admin/internal-users?role=vendedora&active=true');
    });
}
for (const data of [null, {}, [null], [{}], [{ id, fullName: 'Nombre', role: 'admin' }], [{ id: 'bad', fullName: 'Nombre', role: 'vendedora' }]]) {
    test(`listado inválido ${JSON.stringify(data)}`, async () => {
        const f = await fixture({ status: 200, response: { data } });
        await assert.rejects(f.list(), { code: 'invalid_response' });
    });
}
test('POST exacto, replay y clave estable; nuevo intento usa randomUUID', async () => {
    const f = await fixture();
    assert.deepEqual(clone(await f.create()), result);
    assert.deepEqual(clone(await f.create()), result);
    for (const r of f.state.requests) {
        assert.equal(r.url, `/api/admin/consultations/${id}/meeting`); assert.equal(r.method, 'POST');
        assert.deepEqual(clone(r.headers), { Authorization: 'Bearer synthetic-A', 'Content-Type': 'application/json', 'Idempotency-Key': key });
        assert.deepEqual(JSON.parse(r.body), payload);
        assert.equal(r.cache, 'no-store'); assert.equal(r.credentials, 'omit'); assert.equal(r.redirect, 'error');
        assert.ok(r.signal instanceof AbortSignal);
    }
    const nextKey = f.api.createMeetingIdempotencyKey();
    assert.match(nextKey, /^[0-9a-f-]{36}$/); assert.notEqual(nextKey, f.api.createMeetingIdempotencyKey());
    await f.create({ idempotencyKey: nextKey }); assert.equal(f.state.requests[2].headers['Idempotency-Key'], nextKey);
});
for (const overrides of [{ consultationId: 'bad' }, { idempotencyKey: 'bad\r\nx:y' }, { payload: null },
    { payload: {} }, ...['actorId', 'requestHash', 'status', 'createdBy', 'updatedBy'].map(field => ({ payload: { ...payload, [field]: 'forbidden' } })),
    ...Object.keys(payload).filter(field => field !== 'notes').map(field => ({ payload: Object.fromEntries(Object.entries(payload).filter(([name]) => name !== field)) }))]) {
    test(`POST entrada inválida ${JSON.stringify(overrides)}`, async () => {
        const f = await fixture(); await assert.rejects(f.create(overrides), { code: 'invalid_input' });
        assert.equal(f.state.requests.length, 0);
    });
}
for (const [status, code] of [[400, 'operation'], [404, 'operation'], [409, 'operation'], [422, 'operation'], [500, 'server'], [401, 'expired'], [403, 'forbidden']]) {
    test(`POST ${status}: ${code}, sin logout ni exposición`, async () => {
        const f = await fixture({ status, response: { error: { code: 'ACTOR_NOT_ALLOWED', message: 'PRIVATE', details: 'PRIVATE' } } });
        await assert.rejects(f.create(), error => error.code === code && !JSON.stringify(error).includes('PRIVATE'));
        assert.equal(f.state.logout, 0); assert.equal(f.state.refresh, 0); assert.equal(f.state.requests.length, 1);
    });
}
for (const status of [401, 403]) test(`GET ${status} conserva clasificación previa`, async () => {
    const f = await fixture({ status }); await assert.rejects(f.get(), { code: status === 401 ? 'expired' : 'denied' });
});
for (const response of [{}, { data: null }, { data: { consultation: [], meeting: {} } }, { data: { consultation: {} } }]) {
    test('POST respuesta inválida controlada', async () => {
        const f = await fixture({ response }); await assert.rejects(f.create(), { code: 'invalid_response' });
    });
}
test('POST éxito debe ser 201', async () => {
    const f = await fixture({ status: 200 }); await assert.rejects(f.create(), { code: 'invalid_response' });
});
for (const hold of [{ holdRead: 1 }, { holdRead: 2 }, { holdFetch: true }, { holdBody: true }]) {
    for (const cancel of [false, true]) test(`POST espera ${JSON.stringify(hold)}: ${cancel ? 'abort' : 'timeout'}`, async () => {
        const f = await fixture({ ...hold, shortTimeout: true });
        const outcome = f.create().then(() => 'resolved', e => e.code);
        await f.held;
        if (cancel) f.external.abort();
        assert.equal(await bounded(outcome), cancel ? 'stale' : 'timeout');
        f.release.reject(Error('PRIVATE late rejection'));
        await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.state.logout, 0);
    });
}
for (const status of [201, 401, 403, 409]) test(`POST A → B con respuesta tardía ${status}`, async () => {
    const f = await fixture({ holdFetch: true, status });
    let rendered = 'B';
    const outcome = f.create().then(() => { rendered = 'A'; }, error => error.code);
    await f.held; f.state.session = B; f.release.resolve();
    assert.equal(await outcome, 'stale'); assert.equal(rendered, 'B'); assert.equal(f.state.logout, 0);
});
for (const change of ['logout', 'guard', 'token']) test(`POST invalida por ${change}`, async () => {
    const f = await fixture({ holdFetch: true }); const outcome = f.create().catch(e => e.code);
    await f.held;
    if (change === 'logout') { f.state.current = false; f.state.session = null; f.guard.abort(); }
    if (change === 'guard') f.guard.abort();
    if (change === 'token') f.state.session = { ...A, access_token: 'rotated' };
    f.release.resolve(); assert.equal(await outcome, 'stale');
});
test('timeout POST no libera el turno Auth subyacente', async () => {
    const f = await fixture({ holdRead: 1, shortTimeout: true });
    const outcome = f.create().catch(e => e.code); await f.held;
    assert.equal(await bounded(outcome), 'timeout');
    const next = f.auth.getSession(); await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(f.state.active, 1); assert.equal(f.state.reads, 1); assert.equal(f.state.requests.length, 0);
    f.release.resolve(); await next; assert.equal(f.state.reads, 2); assert.equal(f.state.active, 0);
});

test('retry tras fallo de red conserva clave y body del intento', async () => {
    const f = await fixture({ network: true });
    await assert.rejects(f.create(), { code: 'network' });
    f.state.network = false; await f.create();
    assert.equal(f.state.requests.length, 2);
    assert.equal(f.state.requests[0].body, f.state.requests[1].body);
    assert.equal(f.state.requests[0].headers['Idempotency-Key'], f.state.requests[1].headers['Idempotency-Key']);
});
test('403 sin código de dominio es forbidden, no denied ni logout', async () => {
    const f = await fixture({ status: 403, response: { error: { message: 'PRIVATE' } } });
    await assert.rejects(f.create(), { code: 'forbidden', status: 403 });
    assert.equal(f.state.logout, 0);
});
test('abort previo evita sesión y transporte POST', async () => {
    const f = await fixture(); f.external.abort();
    await assert.rejects(f.create(), { code: 'stale' });
    assert.equal(f.state.reads, 0); assert.equal(f.state.requests.length, 0);
});
test('JSON inválido 201 se clasifica invalid_response sin exponer el parser', async () => {
    const f = await fixture({ badJSON: true });
    await assert.rejects(f.create(), error => error.code === 'invalid_response' && error.message === 'invalid_response');
});
test('query requiere valores string y rechaza arrays', async () => {
    const f = await fixture();
    for (const query of [null, [], f.query('({ active: true })'), f.query("({ role: ['vendedora', 'admin'] })")]) {
        await assert.rejects(f.get(query), { code: 'configuration' });
    }
    assert.equal(f.state.requests.length, 0);
});

for (const expression of ['undefined', '({})', "({ role: 'vendedora', active: 'true' })",
    "Object.assign(Object.create(null), { role: 'vendedora', active: 'true' })"]) {
    test(`query admitida ${expression}`, async () => {
        const f = await fixture(); await f.get(f.query(expression));
        assert.equal(f.state.requests[0].url, '/api/admin/consultations' +
            (expression.includes('vendedora') ? '?role=vendedora&active=true' : ''));
    });
}
for (const expression of ['new Date()', '[]', "'role=vendedora'", '123', 'true', 'null',
    "Object.assign(Object.create({ custom: true }), { role: 'vendedora' })",
    "Object.create({ role: 'vendedora', active: 'true' })"]) {
    test(`query no admitida ${expression}`, async () => {
        const f = await fixture();
        await assert.rejects(f.get(f.query(expression)), { code: 'configuration' });
        assert.equal(f.state.requests.length, 0); assert.equal(f.state.reads, 0);
    });
}
for (const status of [200, 202, 204, 206]) {
    test(`POST ${status} no intenta leer JSON`, async () => {
        const f = await fixture({ status, holdBody: true });
        await assert.rejects(bounded(f.create()), { code: 'invalid_response' });
    });
}
for (const rawBody of ['', '{invalid', '<html>PRIVATE</html>', 'PRIVATE text']) {
    test(`201 cuerpo ilegible ${JSON.stringify(rawBody)} -> invalid_response`, async () => {
        const f = await fixture({ rawBody });
        await assert.rejects(f.create(), error => error.code === 'invalid_response' &&
            error.message === 'invalid_response' && !JSON.stringify(error).includes('PRIVATE'));
    });
}

test('Agenda GET exacto, codificación, autenticación y signal opcional', async () => {
    const f = await fixture({ status: 200, response: { data: [agendaRow] } });
    const from = '2026-10-01T00:00:00+05:30';
    const to = '2026-10-02T00:00:00Z&role=admin#fragment';
    assert.deepEqual(clone(await f.agenda({ from, to, signal: undefined })), [agendaRow]);
    const r = f.state.requests[0];
    const url = new URL(r.url, 'https://synthetic.invalid');
    assert.equal(url.pathname, '/api/admin/meetings'); assert.equal(url.hash, '');
    assert.deepEqual([...url.searchParams], [['from', from], ['to', to]]);
    assert.ok(r.url.includes('%2B05%3A30')); assert.ok(r.url.includes('%26role%3Dadmin%23fragment'));
    assert.equal(r.method, 'GET'); assert.equal(r.body, undefined);
    assert.deepEqual(clone(r.headers), { Authorization: 'Bearer synthetic-A' });
    assert.equal(r.cache, 'no-store'); assert.equal(r.credentials, 'omit'); assert.equal(r.redirect, 'error');
    assert.ok(r.signal instanceof AbortSignal); assert.equal(f.state.reads, 2);
});

test('Agenda vacío, modalidades/estados, orden y copias profundas con whitelist', async () => {
    const f = await fixture({ status: 200, response: { data: [] } });
    assert.deepEqual(clone(await f.agenda()), []);
    const rows = ['no_show', 'completed', 'cancelled', 'scheduled'].map((status, index) => ({
        ...clone(agendaRow), status, id: index % 2 ? id : key,
        mode: ['office', 'phone', 'online'][index % 3],
        scheduledAt: index % 2 ? '2026-10-01T10:00:00.123456Z' : agendaRow.scheduledAt,
    }));
    rows[0].consultation.email = 'synthetic@example.invalid';
    const expected = clone(rows);
    const extras = Object.fromEntries(['notes', 'message', 'city', 'createdBy', 'updatedBy',
        'createdAt', 'updatedAt', 'active', 'internalEmail', 'privateSentinel'].map(name => [name, 'PRIVATE']));
    for (const row of rows) for (const object of [row, row.consultation, row.consultation.program, row.assignedTo]) Object.assign(object, extras);
    f.state.response = { data: rows, ...extras };
    const actual = await f.agenda();
    assert.deepEqual(clone(actual), expected); assert.ok(!JSON.stringify(actual).includes('PRIVATE'));
    actual[0].consultation.program.name = 'changed'; actual[0].assignedTo.fullName = 'changed';
    actual[0].consultation.fullName = 'changed'; actual[0].status = 'changed';
    assert.deepEqual(clone(await f.agenda()), expected);
});

for (const options of [undefined, null, [], 'invalid', 42]) test('Agenda options inválidas', async () => {
    const f = await fixture(); await assert.rejects(f.api.getAgendaMeetings(options), { code: 'invalid_input' });
    assert.equal(f.state.reads, 0); assert.equal(f.state.requests.length, 0);
});
for (const overrides of [{ from: '' }, { from: '  ' }, { from: new Date() }, { to: null }, { to: [] },
    { to: ' ' }, { access: null }, { access: {} }, { signal: null }, { signal: {} },
    ...['role', 'userId', 'viewerId', 'sellerId', 'assignedTo', 'path', 'url', 'query', 'fragment'].map(name => ({ [name]: 'PRIVATE' }))]) {
    test(`Agenda rechaza entrada/scope ${Object.keys(overrides)}`, async () => {
        const f = await fixture(); await assert.rejects(f.agenda(overrides), { code: 'invalid_input' });
        assert.equal(f.state.reads, 0); assert.equal(f.state.requests.length, 0);
    });
}
for (const field of ['session', 'signal', 'isCurrent']) test(`Agenda access sin ${field}`, async () => {
    const f = await fixture(); const access = { ...f.access }; delete access[field];
    await assert.rejects(f.agenda({ access }), { code: 'invalid_input' }); assert.equal(f.state.reads, 0);
});
for (const response of [null, [], {}, { data: null }, { data: {} }, { data: [null] }]) test('Agenda envelope inválido', async () => {
    const f = await fixture({ status: 200, response }); await assert.rejects(f.agenda(), { code: 'invalid_response' });
});
for (const [path, value] of [
    ['id', 'bad'], ['consultationRequestId', 'bad'], ['scheduledAt', 'tomorrow'],
    ['scheduledAt', '2026-10-01T10:00:00'], ['scheduledAt', '2026-10-01T25:00:00Z'],
    ['scheduledAt', '2026-10-01T10:00:00Z\n'], ['timeZone', ' '], ['durationMinutes', 0],
    ['durationMinutes', 1.5], ['mode', 'unknown'], ['status', 'unknown'], ['version', 0], ['version', 1.5],
    ['consultation', undefined], ['consultation', []], ['consultation.id', 'bad'],
    ['consultation.fullName', ' '], ['consultation.phone', null], ['consultation.email', 42],
    ['consultation.email', undefined], ['consultation.program', null], ['consultation.program', []],
    ['consultation.program.id', 'bad'], ['consultation.program.code', ''], ['consultation.program.name', ' '],
    ['assignedTo', null], ['assignedTo', []], ['assignedTo.id', 'bad'], ['assignedTo.fullName', ' '],
]) test(`Agenda fila inválida ${path}: ${JSON.stringify(value)} invalida toda la lista`, async () => {
    const row = clone(agendaRow); const keys = path.split('.');
    const field = keys.pop(); const parent = keys.reduce((object, name) => object[name], row); parent[field] = value;
    const f = await fixture({ status: 200, response: { data: [agendaRow, row, agendaRow] } });
    await assert.rejects(f.agenda(), { code: 'invalid_response' });
});
for (const [status, code] of [[400, 'unavailable'], [401, 'expired'], [403, 'denied'], [500, 'server']]) {
    test(`Agenda HTTP ${status} conserva ${code}`, async () => {
        const f = await fixture({ status, response: { error: 'PRIVATE' } });
        await assert.rejects(f.agenda(), error => error.code === code && error.message === code && !JSON.stringify(error).includes('PRIVATE'));
        assert.equal(f.state.logout, 0); assert.equal(f.state.refresh, 0); assert.equal(f.state.requests.length, 1);
    });
}
for (const options of [{ network: true }, { badJSON: true }]) test('Agenda red/JSON ilegible conserva network', async () => {
    const f = await fixture({ status: 200, ...options }); await assert.rejects(f.agenda(), { code: 'network' });
});
for (const status of [200, 201, 202, 206]) test(`Agenda GET ${status} acepta contrato válido`, async () => {
    const f = await fixture({ status, response: { data: [] } }); assert.deepEqual(clone(await f.agenda()), []);
});
test('Agenda 204 sin JSON conserva network', async () => {
    const f = await fixture({ status: 204, badJSON: true }); await assert.rejects(f.agenda(), { code: 'network' });
});
for (const hold of [{ holdRead: 1 }, { holdRead: 2 }, { holdFetch: true }, { holdBody: true }]) {
    for (const cancel of [false, true]) test(`Agenda espera ${JSON.stringify(hold)}: ${cancel ? 'abort' : 'timeout'}`, async () => {
        const f = await fixture({ status: 200, response: { data: [] }, ...hold, shortTimeout: true });
        const outcome = f.agenda().catch(error => error.code); await f.held;
        if (cancel) f.external.abort();
        assert.equal(await bounded(outcome), cancel ? 'stale' : 'timeout');
        f.release.reject(Error('PRIVATE late rejection'));
        await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(f.state.logout, 0);
    });
}
for (const change of ['account', 'token', 'guard', 'current', 'logout']) test(`Agenda descarta respuesta tardía: ${change}`, async () => {
    const f = await fixture({ status: 200, response: { data: [agendaRow] }, holdFetch: true });
    const outcome = f.agenda().catch(error => error.code); await f.held;
    if (change === 'account') f.state.session = B;
    if (change === 'token') f.state.session = { ...A, access_token: 'rotated' };
    if (change === 'guard') f.guard.abort();
    if (change === 'current') f.state.current = false;
    if (change === 'logout') { f.state.session = null; f.guard.abort(); }
    f.release.resolve(); assert.equal(await outcome, 'stale'); assert.equal(f.state.logout, 0);
});
test('Agenda señal ya abortada evita Auth y fetch', async () => {
    const f = await fixture(); f.external.abort(); await assert.rejects(f.agenda(), { code: 'stale' });
    assert.equal(f.state.reads, 0); assert.equal(f.state.requests.length, 0);
});
