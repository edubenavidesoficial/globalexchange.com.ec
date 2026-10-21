import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// Mismo enfoque VM + node:test que frontend: módulos reales, frontera externa simulada.
// config/supabase.js se sustituye ANTES de evaluarse: no se importa env.js ni dotenv.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const assigned = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const consultation = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const key = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const body = { date: '2028-02-29', time: '10:30', timeZone: 'America/Guayaquil',
    durationMinutes: 45, mode: 'online', assignedTo: assigned, notes: null };
const result = { consultation: { id: consultation, status: 'converted' },
    meeting: { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'scheduled' } };
let state;
const clone = value => JSON.parse(JSON.stringify(value));
const fake = {
    auth: { async getUser() {
        state.authCalls++;
        if (state.authError) return { data: null, error: state.authError };
        return { data: { user: { id: actor, user_metadata: { role: 'admin' } } }, error: null };
    } },
    from(table) {
        state.queries.push(table);
        assert.ok(['internal_users', 'consultation_requests', 'meetings'].includes(table), 'Unexpected direct table access');
        const operations = [];
        const query = {
            select(columns, options) { operations.push(options ? ['select', columns, clone(options)] : ['select', columns]); return query; },
            eq(field, value) { operations.push(['eq', field, value]); return query; },
            gte(field, value) { operations.push(['gte', field, value]); return query; },
            lt(field, value) { operations.push(['lt', field, value]); return query; },
            async maybeSingle() {
                assert.deepEqual(operations, [['select', 'id, full_name, role, active'], ['eq', 'id', actor]]);
                return { data: state.profile, error: null };
            },
            order(field, options) { operations.push(['order', field, clone(options)]); return query; },
            then(resolve, reject) {
                if (table === 'meetings') {
                    state.meetingQueries.push(operations);
                    if (state.meetingThrow) return reject(state.meetingThrow);
                    return resolve({ data: state.meetings, error: state.meetingError,
                        count: state.meetingCount === undefined ? state.meetings?.length : state.meetingCount });
                }
                if (table === 'internal_users') {
                    state.listQueries.push(operations);
                    if (state.listThrow) return reject(state.listThrow);
                    return resolve({ data: state.saleswomen, error: state.listError });
                }
                resolve({ data: [], error: null });
            },
        };
        return query;
    },
    async rpc(name, args) {
        state.calls.push({ name, args: clone(args) });
        if (state.rpcThrow) throw state.rpcThrow;
        return { data: name === 'complete_consultation_meeting' ? state.completeData
            : name === 'mark_consultation_meeting_no_show' ? state.noShowData
            : name === 'cancel_consultation_meeting' ? state.cancelData
            : name === 'reschedule_consultation_meeting' ? state.scheduleData : state.data, error: state.rpcError };
    },
};
const context = vm.createContext({ console: { error: (...args) => state.logs.push(clone(args)) } });
const modules = new Map();
async function load(id) {
    if (modules.has(id)) return modules.get(id);
    let module;
    if (id === pathToFileURL(resolve(root, 'src/config/supabase.js')).href) {
        module = new vm.SyntheticModule(['default'], function () { this.setExport('default', fake); }, { context });
    } else if (!id.startsWith('file:')) {
        const native = await import(id);
        module = new vm.SyntheticModule(Object.keys(native), function () {
            for (const name of Object.keys(native)) this.setExport(name, native[name]);
        }, { context });
    } else {
        module = new vm.SourceTextModule(await readFile(fileURLToPath(id), 'utf8'), { context, identifier: id });
    }
    modules.set(id, module);
    await module.link((specifier, parent) => load(specifier.startsWith('.')
        ? new URL(specifier, parent.identifier).href : specifier));
    return module;
}
const appModule = await load(pathToFileURL(resolve(root, 'src/app.js')).href);
await appModule.evaluate();
const app = appModule.namespace.default;
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
beforeEach(() => {
    state = { profile: { id: actor, full_name: 'Persona de prueba', role: 'admin', active: true },
        calls: [], queries: [], authCalls: 0, logs: [], data: clone(result), scheduleData: clone(rescheduled), cancelData: clone(cancelled),
        completeData: { ...rescheduled, status: 'completed' }, noShowData: { ...rescheduled, status: 'no_show' },
        listQueries: [], saleswomen: [], meetings: [], meetingQueries: [] };
});
function send(options = {}) {
    const payload = options.raw ?? JSON.stringify(options.body === undefined ? body : options.body);
    const headers = ['Host', '127.0.0.1',
        'Content-Length', String(Buffer.byteLength(payload))];
    if (options.contentType !== null) headers.push('Content-Type', options.contentType ?? 'application/json');
    if (options.auth !== false) headers.push('Authorization', 'Bearer synthetic-test-token');
    if (options.key !== null) headers.push(options.keyName ?? 'Idempotency-Key', options.key ?? key);
    if (options.extraHeaders) headers.push(...options.extraHeaders);
    return new Promise((resolve, reject) => {
        const req = request({ hostname: '127.0.0.1', port: server.address().port,
            path: options.path ?? `/api/admin/consultations/${options.id ?? consultation}/meeting`,
            method: options.method ?? 'POST', headers }, res => {
            let text = ''; res.setEncoding('utf8'); res.on('data', chunk => text += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
                catch { reject(new Error(`Non-JSON response: HTTP ${res.statusCode}`)); }
            });
        });
        req.on('error', reject); req.end(payload);
    });
}
async function invalid(options, code) {
    const response = await send(options);
    assert.equal(response.status, 400);
    if (code) assert.equal(response.body.error.code, code);
    assert.equal(state.calls.length, 0);
}

for (const contentType of ['application/json', 'application/json; charset=utf-8']) {
    test(`Content-Type ${contentType}: aceptado`, async () => {
        assert.deepEqual(await send({ contentType }), { status: 201, body: { data: result } });
        assert.equal(state.calls.length, 1);
    });
}
for (const contentType of [null, 'text/plain', 'application/x-www-form-urlencoded']) {
    test(`Content-Type ${contentType ?? 'ausente'}: 400 sin RPC`, () =>
        invalid({ contentType }, 'INVALID_REQUEST'));
}

for (const role of ['admin', 'agendadora']) test(`${role}: 201 y una RPC con los 11 argumentos`, async () => {
    state.profile.role = role;
    const response = await send({ extraHeaders: ['X-Actor-Id', assigned], path: `/api/admin/consultations/${consultation}/meeting?actorId=${assigned}` });
    assert.deepEqual(response, { status: 201, body: { data: result } });
    const canonical = { consultationRequestId: consultation, ...body };
    assert.deepEqual(state.calls, [{ name: 'create_consultation_meeting', args: {
        p_actor_id: actor, p_consultation_request_id: consultation, p_idempotency_key: key,
        p_request_hash: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
        p_scheduled_date: body.date, p_scheduled_time: body.time, p_time_zone: body.timeZone,
        p_duration_minutes: 45, p_mode: 'online', p_assigned_to: assigned, p_notes: null,
    } }]);
    assert.deepEqual(state.queries, ['internal_users']);
});
test('vendedora: 403 antes de validar body; no confiar en metadata admin', async () => {
    state.profile.role = 'vendedora';
    assert.equal((await send({ body: {}, key: null })).status, 403);
    assert.equal(state.calls.length, 0);
});
test('sin autenticación: 401', async () => {
    assert.equal((await send({ auth: false })).status, 401);
    assert.equal(state.authCalls, 0); assert.equal(state.calls.length, 0);
});
test('token inválido: 401', async () => {
    const { AuthApiError } = await import('@supabase/supabase-js');
    state.authError = new AuthApiError('synthetic', 401, 'bad_jwt');
    assert.equal((await send()).status, 401); assert.equal(state.calls.length, 0);
});
for (const profile of [null, { id: actor, role: 'admin', active: false }]) test('sin perfil activo: 403', async () => {
    state.profile = profile;
    assert.equal((await send()).status, 403); assert.equal(state.calls.length, 0);
});
test('UUID solicitud inválido', () => invalid({ id: 'bad' }, 'INVALID_CONSULTATION_ID'));
for (const value of [null, '', 'bad', key + ',' + key]) test(`clave inválida: ${value === null ? 'ausente' : 'formato'}`, () => invalid({ key: value }, 'INVALID_IDEMPOTENCY_KEY'));
test('cabecera duplicada incluso con distinto casing', () => invalid({ extraHeaders: ['idempotency-key', key] }, 'INVALID_IDEMPOTENCY_KEY'));
test('cabecera HTTP case-insensitive', async () => assert.equal((await send({ keyName: 'iDeMpOtEnCy-KeY' })).status, 201));
for (const [field, values] of Object.entries({
    date: ['2026-02-30', '2026-02-29', '1900-02-29', '2026-13-01', '2026-00-01', '0000-01-01', '12/10/2026', '2026-1-2', '2028-02-29\n', null, 123],
    time: ['24:00', '8:30', '25:00', '12:60', '10:30:00', '10:30\n', null],
    durationMinutes: [0, -1, 1.5, '45', null, 2147483648],
    mode: ['invalid', null, 1], assignedTo: ['bad', null, assigned+'\n'],
    timeZone: ['', ' ', null, 1, 'x'.repeat(101), 'UTC\u0000'],
    notes: [1, {}, 'x'.repeat(2001), 'text\u0000'],
})) for (const [i, value] of values.entries()) test(`${field} inválido ${i+1}`, () => invalid({ body: { ...body, [field]: value } }, 'INVALID_MEETING_INPUT'));
for (const value of [[], null, 1, 'text']) test('body no objeto', () => invalid({ body: value }));
for (const field of ['actorId', 'status', 'createdBy', 'updatedBy', 'version', 'converted', 'createdAt', 'updatedAt', 'requestHash', 'other']) {
    test(`rechazar propiedad desconocida ${field}`, () => invalid({ body: { ...body, [field]: 'untrusted' } }, 'INVALID_REQUEST'));
}
test('JSON malformado sanitizado sin reflejar contenido', async () => {
    const response = await send({ raw: '{"notes":"PRIVATE_SENTINEL"' });
    assert.equal(response.status, 400); assert.equal(response.body.error.code, 'INVALID_JSON');
    assert.ok(!JSON.stringify(response).includes('PRIVATE_SENTINEL')); assert.equal(state.calls.length, 0);
});
test('hash determinista: orden, casing UUID y trim; notes omitido/vacío/null', async () => {
    for (const notes of [undefined, '', '   ', null]) {
        assert.equal((await send({ id: consultation.toUpperCase(), key: key.toUpperCase(), body: {
            notes, assignedTo: assigned.toUpperCase(), mode: ' online ', durationMinutes: 45,
            timeZone: ' America/Guayaquil ', time: '10:30', date: '2028-02-29',
        } })).status, 201);
    }
    assert.equal(new Set(state.calls.map(c => c.args.p_request_hash)).size, 1);
    assert.ok(state.calls.every(c => c.args.p_notes === null));
    assert.match(state.calls[0].args.p_request_hash, /^[a-f0-9]{64}$/);
});
test('cada campo canónico altera el hash', async () => {
    await send(); const baseline = state.calls.at(-1).args.p_request_hash;
    for (const [field, value] of Object.entries({ date:'2028-03-01', time:'11:00', timeZone:'UTC', durationMinutes:60, mode:'phone', assignedTo:actor, notes:'otra nota' })) {
        await send({ body: { ...body, [field]:value } }); assert.notEqual(state.calls.at(-1).args.p_request_hash, baseline);
    }
    await send({ id: actor }); assert.notEqual(state.calls.at(-1).args.p_request_hash, baseline);
});
test('actor y clave quedan fuera del hash', async () => {
    await send(); const baseline = state.calls[0].args.p_request_hash;
    state.profile.id = assigned;
    await send({ key: actor });
    assert.equal(state.calls[1].args.p_request_hash, baseline);
    assert.equal(state.calls[1].args.p_actor_id, assigned);
});
test('no validar futuro ni elegibilidad ni lista IANA en JS', async () => {
    assert.equal((await send({ body:{...body,date:'2000-01-01',timeZone:'Unknown/Zone',assignedTo:actor} })).status, 201);
    assert.deepEqual(state.queries,['internal_users']);
});
test('00:00, 23:59, año bisiesto secular y rango integer PostgreSQL', async () => {
    for(const time of ['00:00','23:59']) assert.equal((await send({body:{...body,date:'2000-02-29',time,durationMinutes:2147483647}})).status,201);
});
const mapping = {
    INVALID_REQUEST:400, INVALID_MEETING_INPUT:400, ACTOR_NOT_ALLOWED:403,
    CONSULTATION_NOT_FOUND:404, CONSULTATION_CANCELLED:409, CONSULTATION_ALREADY_SCHEDULED:409,
    CONSULTATION_COMPLETED:409, CONSULTATION_STATE_INCONSISTENT:409, IDEMPOTENCY_KEY_REUSED:409,
    ASSIGNEE_NOT_ELIGIBLE:422, INVALID_TIME_ZONE:422, INVALID_LOCAL_TIME:422,
    MEETING_NOT_IN_FUTURE:422, WORKFLOW_ISOLATION_NOT_SUPPORTED:500,
};
for (const [code, status] of Object.entries(mapping)) test(`RPC ${code} -> ${status}`, async () => {
    state.rpcError = {code:'P0001',message:code,details:'PRIVATE_SQL',hint:'PRIVATE_TOKEN'};
    const response = await send(); assert.equal(response.status,status); assert.equal(response.body.error.code,code);
    assert.ok(!JSON.stringify([response,state.logs]).includes('PRIVATE_'));
});
for (const error of [{code:'P0001',message:'UNKNOWN_PRIVATE_SQL'}, {code:'23505',message:'CONSULTATION_NOT_FOUND',details:'PRIVATE_SQL'}, {code:'P0001',message:'toString'}]) {
    test('error RPC desconocido sanitizado en HTTP y logs', async () => {
        state.rpcError=error; const response=await send();
        assert.equal(response.status,500); assert.equal(response.body.error.code,'INTERNAL_ERROR');
        assert.ok(!JSON.stringify([response,state.logs]).includes('PRIVATE'));
        assert.deepEqual(state.logs,[[{event:'request_failed',statusCode:500,code:'INTERNAL_ERROR'}]]);
    });
}
test('rechazo de transporte RPC sanitizado', async () => {
    state.rpcThrow=new Error('PRIVATE_CREDENTIAL');
    assert.equal((await send()).status,500); assert.ok(!JSON.stringify(state.logs).includes('PRIVATE'));
});
for (const data of [null, [], 'bad', {}, {consultation:[],meeting:{}}]) test('respuesta RPC inválida -> 500', async () => {
    state.data=data; assert.equal((await send()).status,500);
});
test('replay exitoso sigue 201; exactamente una RPC por petición', async () => {
    assert.deepEqual(await send(),await send());
    assert.equal(state.calls.length,2); assert.deepEqual(state.calls[0],state.calls[1]);
    assert.deepEqual(state.queries,['internal_users','internal_users']);
});
test('GET solicitudes conserva acceso vendedora y contrato', async () => {
    state.profile.role='vendedora';
    assert.deepEqual(await send({method:'GET',path:'/api/admin/consultations'}),{status:200,body:{data:[]}});
    assert.equal(state.calls.length,0);
});
test('auth/me y health conservan contratos', async () => {
    assert.equal((await send({method:'GET',path:'/api/auth/me'})).body.data.role,'admin');
    assert.equal((await send({method:'GET',path:'/api/health',auth:false})).body.status,'ok');
});

for (const field of ['date','time','timeZone','durationMinutes','mode','assignedTo']) {
    test(`campo obligatorio ausente: ${field}`, async () => {
        const incomplete = { ...body }; delete incomplete[field];
        await invalid({body:incomplete},'INVALID_MEETING_INPUT');
    });
}
test('fallo Auth del proveedor no filtra causas en respuesta ni logs', async () => {
    state.authError = new Error('PRIVATE_AUTH_TOKEN');
    const response = await send();
    assert.equal(response.status,500);
    assert.ok(!JSON.stringify([response,state.logs]).includes('PRIVATE'));
    assert.equal(state.calls.length,0);
});
test('validación POST público conserva error.message', async () => {
    const response = await send({path:'/api/consultations',body:{},auth:false});
    assert.deepEqual(response,{status:400,body:{error:{message:'El programa es obligatorio.'}}});
    assert.equal(state.calls.length,0);
});
test('el grafo de pruebas nunca carga env.js ni dotenv', () => {
    assert.ok(![...modules.keys()].some(id => id.endsWith('/env.js') || id.includes('dotenv')));
});

// Fase 4B.4A: comparte app, transporte HTTP y frontera Supabase simulada.
const usersPath = '/api/admin/internal-users';
const validFilters = '?role=vendedora&active=true';
const listUsers = (options = {}) => send({ method: 'GET', path: usersPath + validFilters, ...options });
const expectedListQuery = [
    ['select', 'id, full_name, role'],
    ['eq', 'role', 'vendedora'],
    ['eq', 'active', true],
    ['order', 'full_name', { ascending: true }],
    ['order', 'id', { ascending: true }],
];

for (const role of ['admin', 'agendadora']) {
    test(`internal-users ${role}: mapeo mínimo y consulta exacta`, async () => {
        state.profile.role = role;
        state.saleswomen = [assigned, consultation].map(id => ({
            id, full_name: 'Persona de prueba', role: 'vendedora', active: true,
            email: 'PRIVATE_EMAIL', created_at: 'PRIVATE_CREATED', updated_at: 'PRIVATE_UPDATED',
            metadata: 'PRIVATE_METADATA', token: 'PRIVATE_TOKEN', password: 'PRIVATE_PASSWORD',
        }));
        const response = await listUsers();
        assert.deepEqual(response, { status: 200, body: { data: [assigned, consultation].map(id => ({
            id, fullName: 'Persona de prueba', role: 'vendedora',
        })) } });
        assert.deepEqual(state.listQueries, [expectedListQuery]);
        assert.deepEqual(state.queries, ['internal_users', 'internal_users']);
        assert.equal(state.calls.length, 0);
        assert.deepEqual(state.logs, []);
    });
}

test('internal-users: cero resultados es 200 con lista vacía', async () => {
    assert.deepEqual(await listUsers(), { status: 200, body: { data: [] } });
    assert.deepEqual(state.listQueries, [expectedListQuery]);
});

test('internal-users: vendedora rechazada antes de validar filtros; body y metadata no autorizan', async () => {
    state.profile.role = 'vendedora';
    const response = await listUsers({ path: usersPath + '?role=admin', body: { role: 'admin' } });
    assert.equal(response.status, 403);
    assert.deepEqual(state.listQueries, []);
    assert.deepEqual(state.queries, ['internal_users']);
});

test('internal-users: sin autenticación no consulta DB', async () => {
    assert.equal((await listUsers({ auth: false })).status, 401);
    assert.equal(state.authCalls, 0);
    assert.deepEqual(state.queries, []);
});

test('internal-users: token inválido no consulta DB', async () => {
    const { AuthApiError } = await import('@supabase/supabase-js');
    state.authError = new AuthApiError('PRIVATE_TOKEN', 401, 'bad_jwt');
    assert.equal((await listUsers()).status, 401);
    assert.deepEqual(state.queries, []);
});

for (const profile of [null, { id: actor, role: 'admin', active: false }]) {
    test(`internal-users: perfil ${profile === null ? 'inexistente' : 'inactivo'} rechazado`, async () => {
        state.profile = profile;
        assert.equal((await listUsers()).status, 403);
        assert.deepEqual(state.queries, ['internal_users']);
        assert.deepEqual(state.listQueries, []);
    });
}

for (const filters of [
    '', '?active=true', '?role=vendedora',
    '?role=admin&active=true', '?role=agendadora&active=true', '?role=Vendedora&active=true',
    '?role=vendedora&active=false', '?role=vendedora&active=1', '?role=vendedora&active=yes',
    '?role=vendedora&active=True', '?role=&active=true', '?role=vendedora&active=',
    '?role=%20vendedora&active=true', '?role=vendedora&active=true%20',
    '?role=vendedora&active=true&extra=PRIVATE_SENTINEL',
    '?role=vendedora&role=admin&active=true', '?role=vendedora&active=true&active=false',
    '?role=vendedora&role=vendedora&active=true', '?role=vendedora&active=true&active=true',
    '?role[]=vendedora&active=true', '?role=vendedora&active[]=true',
    '?role=vendedora&active=true&__proto__=PRIVATE_SENTINEL',
]) {
    test(`internal-users: filtros inválidos ${filters || 'ausentes'}`, async () => {
        const response = await listUsers({ path: usersPath + filters });
        assert.deepEqual(response, { status: 400, body: { error: {
            message: 'Los filtros deben ser role=vendedora y active=true.',
        } } });
        assert.deepEqual(state.listQueries, []);
        assert.deepEqual(state.queries, ['internal_users']);
        assert.equal(state.calls.length, 0);
        assert.deepEqual(state.logs, []);
    });
}

for (const suffix of ['role=admin', 'active=false', 'extra=x', '%72ole=vendedora', '%61ctive=true']) {
    test(`internal-users: query completa tras 1000 separadores, ${suffix}`, async () => {
        const response = await listUsers({ path: usersPath + validFilters + '&'.repeat(1000) + suffix });
        assert.equal(response.status, 400);
        assert.deepEqual(state.listQueries, []);
        assert.deepEqual(state.queries, ['internal_users']);
        assert.deepEqual(state.logs, []);
    });
}

for (const filters of ['?%72ole=vendedora&%61ctive=true', '?active=true&role=vendedora']) {
    test(`internal-users: query equivalente válida ${filters}`, async () => {
        assert.deepEqual(await listUsers({ path: usersPath + filters }), { status: 200, body: { data: [] } });
        assert.deepEqual(state.listQueries, [expectedListQuery]);
    });
}

const validSaleswoman = { id: assigned, full_name: 'Persona sintética', role: 'vendedora' };
const invalidRows = [
    {}, 123, null, undefined, [],
    { full_name: 'PRIVATE_NAME', role: 'vendedora' },
    { id: assigned, role: 'vendedora' },
    { id: assigned, full_name: 'PRIVATE_NAME' },
    { ...validSaleswoman, role: 'admin' },
    { ...validSaleswoman, id: 'invalid-uuid' },
    { ...validSaleswoman, id: assigned + '\n' },
    { ...validSaleswoman, id: 123 },
    { ...validSaleswoman, full_name: null },
    { ...validSaleswoman, full_name: 123 },
    { ...validSaleswoman, full_name: '' },
    { ...validSaleswoman, full_name: '   ' },
];
for (const [index, data] of [null, undefined, {}, 123, ...invalidRows.map(row => [row]),
    [validSaleswoman, {}]].entries()) {
    test(`internal-users: estructura DB inválida ${index} -> 500 sin respuesta parcial`, async () => {
        state.saleswomen = data;
        assert.deepEqual(await listUsers(), { status: 500, body: { error: {
            message: 'Ocurrió un error interno en el servidor.',
        } } });
        assert.deepEqual(state.logs, [[{ event: 'request_failed', statusCode: 500, code: 'INTERNAL_ERROR' }]]);
        assert.deepEqual(state.listQueries, [expectedListQuery]);
    });
}

for (const transportFailure of [false, true]) {
    test(`internal-users: ${transportFailure ? 'rechazo de transporte' : 'error Supabase 400'} sanitizado`, async () => {
        const error = Object.assign(new Error('password=PRIVATE_SECRET SELECT * FROM users'), {
            statusCode: 400, code: 'PRIVATE_CODE', details: 'PRIVATE_DETAILS', hint: 'PRIVATE_HINT',
        });
        if (transportFailure) state.listThrow = error;
        else state.listError = error;
        const response = await listUsers();
        assert.deepEqual(response, { status: 500, body: { error: { message: 'Ocurrió un error interno en el servidor.' } } });
        assert.deepEqual(state.logs, [[{ event: 'request_failed', statusCode: 500, code: 'INTERNAL_ERROR' }]]);
        assert.deepEqual(state.listQueries, [expectedListQuery]);
        assert.equal(state.calls.length, 0);
    });
}

// Fase 4C.1: HTTP y módulos reales, sin configuración ni transporte remoto.
const agendaPath = '/api/admin/meetings';
const rangeQuery = '?from=2026-10-01T00:00:00-05:00&to=2026-11-01T00:00:00-05:00';
const agenda = options => send({ method: 'GET', path: agendaPath + rangeQuery, ...options });
const meetingRow = {
    id: key, consultation_request_id: consultation, scheduled_at: '2026-10-07T15:00:00+00:00',
    time_zone: 'America/Guayaquil', duration_minutes: 45, mode: 'online', status: 'scheduled', version: 1,
    consultation: { id: consultation, full_name: 'Solicitante sintético', phone: '0000000000', email: null,
        program: { id: assigned, code: 'fixture', name: 'Programa sintético' } },
    assigned_user: { id: actor, full_name: 'Vendedora sintética' },
};
const meetingSelect = 'id, consultation_request_id, scheduled_at, time_zone, duration_minutes, mode, status, version, consultation:consultation_requests!consultation_request_id ( id, full_name, phone, email, program:programs!program_id (id, code, name) ), assigned_user:internal_users!assigned_to (id, full_name)';
for (const role of ['admin', 'agendadora', 'vendedora']) test(`agenda ${role}: scope DB, joins explícitos y contrato mínimo`, async () => {
    state.profile.role = role;
    state.meetings = [clone(meetingRow)];
    const response = await agenda({ body: { role: 'admin', assignedTo: assigned, viewerId: assigned }, extraHeaders: ['X-User-Id', assigned, 'X-Role', 'admin'] });
    assert.deepEqual(response, { status: 200, body: { data: [{ id: key, consultationRequestId: consultation,
        scheduledAt: meetingRow.scheduled_at, timeZone: 'America/Guayaquil', durationMinutes: 45,
        mode: 'online', status: 'scheduled', version: 1,
        consultation: { id: consultation, fullName: 'Solicitante sintético', phone: '0000000000', email: null,
            program: { id: assigned, code: 'fixture', name: 'Programa sintético' } },
        assignedTo: { id: actor, fullName: 'Vendedora sintética' } }] } });
    const operations = state.meetingQueries[0];
    assert.equal(operations[0][1].trim().replace(/\s+/g, ' '), meetingSelect);
    assert.deepEqual(operations[0][2], { count: 'exact' });
    assert.deepEqual(operations.slice(1), [
        ['gte', 'scheduled_at', '2026-10-01T05:00:00.000000Z'],
        ['lt', 'scheduled_at', '2026-11-01T05:00:00.000000Z'],
        ...(role === 'vendedora' ? [['eq', 'assigned_to', actor]] : []),
        ['order', 'scheduled_at', { ascending: true }], ['order', 'id', { ascending: true }],
    ]);
    assert.deepEqual(state.queries, ['internal_users', 'meetings']);
    assert.equal(state.calls.length, 0);
});
test('agenda: vacío es 200', async () => assert.deepEqual(await agenda(), { status: 200, body: { data: [] } }));
test('agenda: sin auth 401', async () => {
    assert.equal((await agenda({ auth: false })).status, 401); assert.deepEqual(state.queries, []);
});
test('agenda: token inválido 401', async () => {
    const { AuthApiError } = await import('@supabase/supabase-js');
    state.authError = new AuthApiError('synthetic', 401, 'bad_jwt');
    assert.equal((await agenda()).status, 401); assert.deepEqual(state.queries, []);
});
for (const profile of [null, { id: actor, role: 'vendedora', active: false }, { id: actor, role: 'other', active: true }]) test('agenda: perfil no autorizado 403 sin listado', async () => {
    state.profile = profile; assert.equal((await agenda()).status, 403); assert.deepEqual(state.meetingQueries, []);
});
const range = (from, to) => '?' + new URLSearchParams({ from, to });
for (const query of [
    '', '?from=2026-10-01T00:00:00Z', '?to=2026-11-01T00:00:00Z',
    range('', '2026-11-01T00:00:00Z'), range('2026-10-01T00:00:00Z', ''),
    ...['from', 'to', '%66rom', '%74o'].map(name => rangeQuery + '&' + name + '=2026-10-01T00:00:00Z'),
    ...['extra', 'role', 'assignedTo', 'viewerId', 'userId', 'sellerId', 'status'].map(name => rangeQuery + '&' + name + '=' + assigned),
    ...['extra=x', '%66rom=bad', 'to=bad'].map(suffix => rangeQuery + '&'.repeat(1000) + suffix),
]) test(`agenda: query rechazada ${query.slice(-85)}`, async () => {
    state.profile.role = 'vendedora';
    assert.equal((await agenda({ path: agendaPath + query })).status, 400);
    assert.deepEqual(state.meetingQueries, []); assert.deepEqual(state.logs, []);
});
for (const from of ['2026-10-07T10:00:00', '2026-02-30T10:00:00Z', '1900-02-29T00:00:00Z',
    '2026-10-07T24:00:00Z', '2026-10-07T10:60:00Z', '2026-10-07T10:00:60Z', 'arbitrary',
    '2026-10-07T10:00:00+24:00', '2026-10-07T10:00:00+01:60', '2026-10-07T10:00:00-00:00',
    '2026-10-07T10:00:00Z\n', '2026-10-07T10:00:00.1234567Z', '0000-01-01T00:00:00Z']) {
    test(`agenda: timestamp inválido ${JSON.stringify(from)}`, async () => {
        assert.equal((await agenda({ path: agendaPath + range(from, '2026-11-01T00:00:00Z') })).status, 400);
        assert.deepEqual(state.meetingQueries, []);
    });
}
for (const [from, to, status] of [
    ['2026-10-07T10:00:00-05:00', '2026-10-07T15:00:00Z', 400],
    ['2026-10-08T00:00:00Z', '2026-10-07T00:00:00Z', 400],
    ['2026-10-01T00:00:00Z', '2026-11-15T00:00:00Z', 200],
    ['2026-10-01T00:00:00Z', '2026-11-15T00:00:00.000001Z', 400],
    ['2026-10-01T00:00:00.000001Z', '2026-10-01T00:00:00.000002Z', 200],
    ['2000-02-29t00:00:00z', '2000-03-01T00:00:00+00:00', 200],
]) test(`agenda: rango ${from} / ${to}`, async () => {
    assert.equal((await agenda({ path: agendaPath + range(from, to) })).status, status);
    assert.equal(state.meetingQueries.length, status === 200 ? 1 : 0);
});
test('agenda: orden inverso y nombres codificados válidos', async () => {
    assert.equal((await agenda({ path: agendaPath + '?%74o=2026-11-01T05:00:00Z&%66rom=2026-10-01T06:00:00%2B01:00' })).status, 200);
    assert.deepEqual(state.meetingQueries[0].slice(1, 3), [['gte', 'scheduled_at', '2026-10-01T05:00:00.000000Z'], ['lt', 'scheduled_at', '2026-11-01T05:00:00.000000Z']]);
});
test('agenda: todos los estados y asignada histórica inactiva; extras nunca expuestos', async () => {
    state.meetings = ['scheduled', 'completed', 'cancelled', 'no_show'].map(status => ({
        ...clone(meetingRow), status, notes: 'PRIVATE', created_by: 'PRIVATE', updated_by: 'PRIVATE',
        created_at: 'PRIVATE', updated_at: 'PRIVATE', audit: 'PRIVATE', idempotency: 'PRIVATE',
        consultation: { ...clone(meetingRow.consultation), email: 'fixture@example.invalid', message: 'PRIVATE', city: 'PRIVATE' },
        assigned_user: { ...meetingRow.assigned_user, active: false, email: 'PRIVATE', metadata: 'PRIVATE' },
    }));
    const response = await agenda(); assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.map(row => row.status), ['scheduled', 'completed', 'cancelled', 'no_show']);
    assert.ok(!JSON.stringify(response).includes('PRIVATE'));
    assert.equal(state.meetingQueries[0].some(op => op[0] === 'eq'), false);
});
const badMeetingRows = [null, [], {},
    ...Object.entries({ id: 'bad', consultation_request_id: 'bad', scheduled_at: '2026-02-30T00:00:00Z',
        time_zone: ' ', duration_minutes: 0, version: 1.5, mode: 'bad', status: 'bad',
        consultation: null, assigned_user: [] }).map(([field, value]) => ({ ...clone(meetingRow), [field]: value })),
    ...[{}, [], null, { id: assigned, code: 'x', name: '' }].map(program => ({ ...clone(meetingRow), consultation: { ...clone(meetingRow.consultation), program } })),
    ...[{ email: 123 }, { phone: null }, { full_name: '' }, { id: assigned }].map(patch => ({ ...clone(meetingRow), consultation: { ...clone(meetingRow.consultation), ...patch } })),
    { ...clone(meetingRow), assigned_user: { id: 'bad', full_name: 'Name' } },
    { ...clone(meetingRow), scheduled_at: '2026-11-01T05:00:00Z' },
];
for (const [i, row] of badMeetingRows.entries()) test(`agenda: fila/relación inválida ${i}, sin respuesta parcial`, async () => {
    state.meetings = [clone(meetingRow), row];
    assert.equal((await agenda()).status, 500);
    assert.deepEqual(state.logs, [[{ event: 'request_failed', statusCode: 500, code: 'INTERNAL_ERROR' }]]);
});
for (const data of [null, {}, 'bad']) test('agenda: listado no array', async () => {
    state.meetings = data; assert.equal((await agenda()).status, 500);
});
test('agenda: respuesta fuera del scope falla cerrada', async () => {
    state.profile.role = 'vendedora'; state.meetings = [{ ...clone(meetingRow), assigned_user: { id: assigned, full_name: 'Other' } }];
    assert.equal((await agenda()).status, 500);
    assert.ok(state.meetingQueries[0].some(op => op[0] === 'eq' && op[2] === actor));
});
test('agenda: el scope usa id del perfil interno, no metadata ni cabeceras', async () => {
    state.profile = { id: assigned, full_name: 'Perfil interno sintético', role: 'vendedora', active: true };
    state.meetings = [{ ...clone(meetingRow), assigned_user: { id: assigned, full_name: 'Asignada' } }];
    assert.equal((await agenda({ body: { userId: actor, role: 'admin' }, extraHeaders: ['X-User-Id', actor] })).status, 200);
    assert.ok(state.meetingQueries[0].some(op => op[0] === 'eq' && op[1] === 'assigned_to' && op[2] === assigned));
});
for (const count of [null, 1]) test('agenda: conteo ausente o truncado nunca devuelve éxito parcial', async () => {
    state.meetingCount = count; assert.equal((await agenda()).status, 500);
});
for (const transport of [false, true]) test(`agenda: error proveedor/transporte ${transport} sanitizado`, async () => {
    const error = Object.assign(new Error('PRIVATE_SQL'), { statusCode: 400, details: 'PRIVATE', hint: 'PRIVATE', cause: 'PRIVATE' });
    if (transport) state.meetingThrow = error; else state.meetingError = error;
    const response = await agenda(); assert.deepEqual(response, { status: 500, body: { error: { message: 'Ocurrió un error interno en el servidor.' } } });
    assert.deepEqual(state.logs, [[{ event: 'request_failed', statusCode: 500, code: 'INTERNAL_ERROR' }]]);
});

// Fase 4D.1B: mismo harness HTTP/VM; RPC completamente simulada.
const meetingId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const scheduleBody = { date: '2028-02-29', time: '10:30', timeZone: 'America/Guayaquil', durationMinutes: 45, mode: 'online', expectedVersion: 1 };
const rescheduled = { id: meetingId, consultationRequestId: consultation, scheduledAt: '2028-02-29T15:30:00+00:00', timeZone: 'America/Guayaquil', durationMinutes: 45, mode: 'online', status: 'scheduled', version: 2 };
const patchSchedule = (options = {}) => send({ method: 'PATCH', path: `/api/admin/meetings/${options.id ?? meetingId}/schedule`, body: scheduleBody, ...options });
async function invalidSchedule(options, code = 'INVALID_MEETING_INPUT') {
    const r = await patchSchedule(options);
    assert.equal(r.status, 400); assert.equal(r.body.error.code, code);
    assert.equal(state.calls.length, 0);
}
for (const role of ['admin', 'agendadora']) test(`schedule ${role}: 200, diez argumentos y una RPC sin queries comerciales`, async () => {
    state.profile.role = role;
    const r = await patchSchedule({ path: `/api/admin/meetings/${meetingId}/schedule?actorId=${assigned}`, extraHeaders: ['X-Actor-Id', assigned] });
    assert.deepEqual(r, { status: 200, body: { data: rescheduled } });
    const canonical = { meetingId, expectedVersion: 1, date: scheduleBody.date, time: scheduleBody.time, timeZone: scheduleBody.timeZone, durationMinutes: 45, mode: 'online' };
    assert.deepEqual(state.calls, [{ name: 'reschedule_consultation_meeting', args: {
        p_actor_id: actor, p_meeting_id: meetingId, p_idempotency_key: key,
        p_request_hash: createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex'),
        p_expected_version: 1, p_scheduled_date: scheduleBody.date, p_scheduled_time: scheduleBody.time,
        p_time_zone: scheduleBody.timeZone, p_duration_minutes: 45, p_mode: 'online',
    } }]);
    assert.deepEqual(state.queries, ['internal_users']);
});
test('schedule vendedora: 403 antes de body/key, metadata y headers no autorizan', async () => {
    state.profile.role = 'vendedora';
    assert.equal((await patchSchedule({ body: { role: 'admin' }, key: null, extraHeaders: ['X-Role', 'admin'] })).status, 403);
    assert.equal(state.calls.length, 0);
});
test('schedule sin token: 401 y cero RPC', async () => {
    assert.equal((await patchSchedule({ auth: false })).status, 401); assert.equal(state.calls.length, 0);
});
test('schedule token inválido: 401 y cero RPC', async () => {
    const { AuthApiError } = await import('@supabase/supabase-js');
    state.authError = new AuthApiError('synthetic', 401, 'bad_jwt');
    assert.equal((await patchSchedule()).status, 401); assert.equal(state.calls.length, 0);
});
for (const profile of [null, { id: actor, role: 'admin', active: false }]) test('schedule perfil ausente/inactivo: 403', async () => {
    state.profile = profile; assert.equal((await patchSchedule()).status, 403); assert.equal(state.calls.length, 0);
});
for (const contentType of ['application/json', 'application/json; charset=utf-8']) test(`schedule Content-Type ${contentType}`, async () => {
    assert.equal((await patchSchedule({ contentType })).status, 200);
});
for (const contentType of [null, 'text/plain', 'application/x-www-form-urlencoded', 'application/xml']) test(`schedule rechaza Content-Type ${contentType}`, () => invalidSchedule({ contentType }, 'INVALID_REQUEST'));
for (const id of ['bad', meetingId.slice(1), `%20${meetingId}`, `${meetingId}%0A`]) test(`schedule UUID inválido ${id}`, () => invalidSchedule({ id }, 'INVALID_MEETING_ID'));
for (const value of [null, '', 'bad', key + ',' + key]) test(`schedule key inválida ${value}`, () => invalidSchedule({ key: value }, 'INVALID_IDEMPOTENCY_KEY'));
test('schedule key duplicada con otro casing', () => invalidSchedule({ extraHeaders: ['iDEMPOTENCY-kEY', key] }, 'INVALID_IDEMPOTENCY_KEY'));
test('schedule nombre de header case-insensitive', async () => assert.equal((await patchSchedule({ keyName: 'iDEMPOTENCY-kEY' })).status, 200));
for (const value of [null, [], 'text', 1]) test(`schedule body no objeto ${JSON.stringify(value)}`, async () => {
    assert.equal((await patchSchedule({ body: value })).status, 400); assert.equal(state.calls.length, 0);
});
for (const field of Object.keys(scheduleBody)) test(`schedule obligatorio ${field}`, async () => {
    const body = { ...scheduleBody }; delete body[field]; await invalidSchedule({ body });
});
for (const field of ['assignedTo', 'notes', 'status', 'version', 'scheduledAt', 'consultationRequestId', 'actorId', 'createdBy', 'updatedBy', 'requestHash', 'idempotencyKey', '__proto__', 'constructor']) {
    test(`schedule propiedad extra ${field}`, () => invalidSchedule({ body: { ...scheduleBody, [field]: 'PRIVATE' } }, 'INVALID_REQUEST'));
}
for (const [field, values] of Object.entries({
    expectedVersion: [null, 0, -1, 1.5, '1', 2147483648],
    date: ['0000-01-01', '1900-02-29', '2027-02-29', '2028-04-31', '2028-13-01', '2028-00-01', '2028-02-00', '2028-2-1', '2028-02-29\n', null],
    time: ['24:00', '1:00', '12:60', '12:00:00', '12:00Z', '12:00 ', null],
    timeZone: ['', ' ', 'UTC\u0000', 'x'.repeat(101), 1, null],
    durationMinutes: [0, -1, 1.5, '45', 2147483648, null], mode: ['presencial', 'ONLINE', 1, null],
})) for (const [i, value] of values.entries()) test(`schedule ${field} inválido ${i}`, () => invalidSchedule({ body: { ...scheduleBody, [field]: value } }));
test('schedule JSON malformado sanitizado', async () => {
    const r = await patchSchedule({ raw: '{"PRIVATE":"' });
    assert.equal(r.status, 400); assert.equal(r.body.error.code, 'INVALID_JSON');
    assert.ok(!JSON.stringify([r, state.logs]).includes('PRIVATE')); assert.equal(state.calls.length, 0);
});
test('schedule hash: orden JSON, UUID casing y normalización', async () => {
    await patchSchedule();
    assert.equal((await patchSchedule({ id: meetingId.toUpperCase(), key: key.toUpperCase(), body: {
        mode: ' online ', expectedVersion: 1, durationMinutes: 45, timeZone: ' America/Guayaquil ', time: '10:30', date: '2028-02-29',
    } })).status, 200);
    assert.deepEqual(state.calls[0], state.calls[1]);
    assert.match(state.calls[0].args.p_request_hash, /^[a-f0-9]{64}$/);
});
test('schedule hash: todos los campos canónicos lo modifican', async () => {
    await patchSchedule(); const baseline = state.calls[0].args.p_request_hash;
    for (const [field, value] of Object.entries({ expectedVersion: 2, date: '2028-03-01', time: '11:00', timeZone: 'UTC', durationMinutes: 60, mode: 'phone' })) {
        await patchSchedule({ body: { ...scheduleBody, [field]: value } });
        assert.notEqual(state.calls.at(-1).args.p_request_hash, baseline);
    }
    state.scheduleData = { ...rescheduled, id: assigned };
    await patchSchedule({ id: assigned }); assert.notEqual(state.calls.at(-1).args.p_request_hash, baseline);
});
test('schedule hash excluye actor y clave; actor siempre del perfil', async () => {
    await patchSchedule(); state.profile.id = assigned;
    await patchSchedule({ key: actor });
    assert.equal(state.calls[0].args.p_request_hash, state.calls[1].args.p_request_hash);
    assert.equal(state.calls[1].args.p_actor_id, assigned); assert.equal(state.calls[1].args.p_idempotency_key, actor);
});
test('schedule delega futuro, IANA y versión actual; admite límites representacionales', async () => {
    for (const time of ['00:00', '23:59']) assert.equal((await patchSchedule({ body: { ...scheduleBody, date: '2000-02-29', time, timeZone: 'Unknown/Zone', expectedVersion: 2147483647, durationMinutes: 2147483647 } })).status, 200);
    assert.deepEqual(state.queries, ['internal_users', 'internal_users']);
});
test('schedule replay simulado: mismo 200 y misma RPC sin nueva key', async () => {
    const first = await patchSchedule(), second = await patchSchedule();
    assert.deepEqual(first, { status: 200, body: { data: rescheduled } }); assert.deepEqual(second, first);
    assert.equal(state.calls.length, 2); assert.deepEqual(state.calls[0], state.calls[1]);
});
const scheduleMapping = { INVALID_REQUEST: 400, INVALID_MEETING_INPUT: 400, ACTOR_NOT_ALLOWED: 403,
    MEETING_NOT_FOUND: 404, MEETING_NOT_SCHEDULED: 409, MEETING_VERSION_CONFLICT: 409,
    IDEMPOTENCY_KEY_REUSED: 409, CONSULTATION_STATE_INCONSISTENT: 409, CONSULTATION_ALREADY_SCHEDULED: 409,
    INVALID_TIME_ZONE: 422, INVALID_LOCAL_TIME: 422, MEETING_NOT_IN_FUTURE: 422,
    WORKFLOW_ISOLATION_NOT_SUPPORTED: 500, INTERNAL_ERROR: 500 };
for (const [code, status] of Object.entries(scheduleMapping)) test(`schedule RPC ${code} -> ${status}`, async () => {
    state.rpcError = { code: 'P0001', message: code, details: 'PRIVATE_SQL', hint: 'PRIVATE_TOKEN' };
    const r = await patchSchedule(); assert.equal(r.status, status); assert.equal(r.body.error.code, code);
    assert.ok(!JSON.stringify([r, state.logs]).includes('PRIVATE'));
});
for (const error of [{ code: 'P0001', message: 'PRIVATE_UNKNOWN' }, { code: '23505', message: 'MEETING_NOT_FOUND' }, { code: 'P0001', message: 'toString' }, { statusCode: 403, message: 'PRIVATE' }]) test('schedule error desconocido sanitizado', async () => {
    state.rpcError = error; const r = await patchSchedule();
    assert.equal(r.status, 500); assert.equal(r.body.error.code, 'INTERNAL_ERROR');
    assert.ok(!JSON.stringify([r, state.logs]).includes('PRIVATE'));
});
test('schedule transporte rechazado sanitizado', async () => {
    state.rpcThrow = new Error('PRIVATE_SECRET'); const r = await patchSchedule();
    assert.equal(r.status, 500); assert.ok(!JSON.stringify([r, state.logs]).includes('PRIVATE'));
});
for (const [i, value] of [null, [], {}, 'bad', ...Object.entries({
    id: 'bad', consultationRequestId: 'bad', scheduledAt: 'now', timeZone: ' ', durationMinutes: 0,
    mode: 'bad', status: 'completed', version: 0,
}).map(([k, v]) => ({ ...rescheduled, [k]: v })),
    ...Object.keys(rescheduled).map(k => { const r = { ...rescheduled }; delete r[k]; return r; }),
    ...['cancelled', 'no_show', null].map(status => ({ ...rescheduled, status })),
    ...['1', 1.5, 2147483648, null].map(version => ({ ...rescheduled, version })),
    ...['2028-02-30T15:30:00Z', '2028-02-29T15:30:00', '2028-02-29T15:30:00.1234567Z'].map(scheduledAt => ({ ...rescheduled, scheduledAt })),
    { ...rescheduled, id: assigned },
].entries()) test(`schedule respuesta inválida ${i}: 500`, async () => {
    state.scheduleData = value; const r = await patchSchedule();
    assert.equal(r.status, 500); assert.equal(r.body.error.code, 'INTERNAL_ERROR');
    assert.deepEqual(state.logs, [[{ event: 'request_failed', statusCode: 500, code: 'INTERNAL_ERROR' }]]);
});
test('schedule minimiza extras y acepta timestamp PostgreSQL con microsegundos', async () => {
    const safe = { ...rescheduled, scheduledAt: '2028-02-29T15:30:00.123456+00:00' };
    state.scheduleData = { ...safe, assignedTo: 'PRIVATE', notes: 'PRIVATE', createdBy: 'PRIVATE', updatedBy: 'PRIVATE', audit: 'PRIVATE', requestHash: 'PRIVATE', idempotency: 'PRIVATE' };
    assert.deepEqual(await patchSchedule(), { status: 200, body: { data: safe } });
});
test('schedule normalizador rechaza instancias, herencia, getters y símbolos sin ejecutar getter', () => {
    const service = modules.get(pathToFileURL(resolve(root, 'src/modules/meetings/meetings.service.js')).href).namespace;
    let reads = 0;
    const accessor = { ...scheduleBody }; Object.defineProperty(accessor, 'date', { get() { reads++; return '2028-02-29'; } });
    for (const candidate of [Object.assign(Object.create({}), scheduleBody), Object.create(scheduleBody), Object.assign(new Date(), scheduleBody), accessor, { ...scheduleBody, [Symbol('extra')]: 1 }]) {
        assert.throws(() => service.normalizeReschedule(meetingId, candidate), e => e.code === 'INVALID_REQUEST');
    }
    assert.equal(reads, 0); assert.equal(state.calls.length, 0);
    assert.equal(service.normalizeReschedule(meetingId, { ...scheduleBody }).meetingId, meetingId);
});

// Fase 4D.2C: Express real con la misma frontera Supabase simulada; sin PostgreSQL.
const cancelBody = { expectedVersion: 1, reason: 'client_request' };
const cancelled = { ...rescheduled, status: 'cancelled' };
const patchCancel = (options = {}) => send({ method: 'PATCH', path: `/api/admin/meetings/${options.id ?? meetingId}/cancel`, body: cancelBody, ...options });
const meetingModule = name => modules.get(pathToFileURL(resolve(root, `src/modules/meetings/meetings.${name}.js`)).href).namespace;
async function invalidCancel(options, code = 'INVALID_MEETING_INPUT') {
    const r = await patchCancel(options);
    assert.equal(r.status, 400); assert.equal(r.body.error.code, code);
    assert.equal(state.calls.length, 0);
}

for (const role of ['admin', 'agendadora']) test(`cancel ${role}: PATCH 200 y exactamente seis argumentos`, async () => {
    state.profile.role = role;
    assert.deepEqual(await patchCancel({ path: `/api/admin/meetings/${meetingId}/cancel?actorId=${assigned}&role=admin`,
        extraHeaders: ['X-Actor-Id', assigned, 'X-Role', 'admin'] }), { status: 200, body: { data: cancelled } });
    assert.deepEqual(state.calls, [{ name: 'cancel_consultation_meeting', args: {
        p_actor_id: actor, p_meeting_id: meetingId, p_idempotency_key: key,
        p_request_hash: createHash('sha256').update(JSON.stringify({ meetingId, expectedVersion: 1, reason: 'client_request' }), 'utf8').digest('hex'),
        p_expected_version: 1, p_reason: 'client_request',
    } }]);
    assert.deepEqual(state.queries, ['internal_users']);
});
for (const method of ['GET', 'POST', 'PUT', 'DELETE']) test(`cancel no registra ${method}`, async () => {
    await assert.rejects(patchCancel({ method }), /Non-JSON response: HTTP 404/);
    assert.equal(state.calls.length, 0);
});
test('cancel ruta sin id no ejecuta RPC', async () => {
    await assert.rejects(patchCancel({ path: '/api/admin/meetings/cancel' }), /Non-JSON response: HTTP 404/);
    assert.equal(state.calls.length, 0);
});
test('cancel vendedora: no confiar en metadata, body ni header de rol', async () => {
    state.profile.role = 'vendedora';
    assert.deepEqual(await patchCancel({ body: { role: 'admin' }, key: null, extraHeaders: ['X-Role', 'admin'] }),
        { status: 403, body: { error: { message: 'No tienes permisos para realizar esta acción.' } } });
    assert.equal(state.calls.length, 0);
});
test('cancel sin token: 401', async () => {
    assert.deepEqual(await patchCancel({ auth: false }),
        { status: 401, body: { error: { message: 'Se requiere una autenticación válida.' } } });
    assert.equal(state.authCalls, 0); assert.equal(state.calls.length, 0);
});
test('cancel token inválido: 401', async () => {
    const { AuthApiError } = await import('@supabase/supabase-js');
    state.authError = new AuthApiError('synthetic', 401, 'bad_jwt');
    assert.equal((await patchCancel()).status, 401); assert.equal(state.calls.length, 0);
});
for (const profile of [null, { id: actor, role: 'admin', active: false }]) test('cancel perfil ausente/inactivo: 403', async () => {
    state.profile = profile;
    assert.equal((await patchCancel()).status, 403); assert.equal(state.calls.length, 0);
});
test('cancel fallo del proveedor auth: 500 sanitizado', async () => {
    state.authError = new Error('PRIVATE_TOKEN');
    const r = await patchCancel(); assert.equal(r.status, 500); assert.equal(state.calls.length, 0);
    assert.ok(!JSON.stringify([r, state.logs]).includes('PRIVATE'));
});

for (const contentType of ['application/json', 'application/json; charset=utf-8']) test(`cancel Content-Type ${contentType}`, async () => {
    assert.equal((await patchCancel({ contentType })).status, 200);
});
for (const contentType of [null, 'text/plain', 'application/x-www-form-urlencoded', 'application/xml']) test(`cancel Content-Type rechazado ${contentType}`, () => invalidCancel({ contentType }, 'INVALID_REQUEST'));
for (const id of ['bad', meetingId.slice(1), `%20${meetingId}`, `${meetingId}%20`, `${meetingId}%0A`]) test(`cancel UUID inválido ${id}`, () => invalidCancel({ id }, 'INVALID_MEETING_ID'));
// Node HTTP elimina OWS periférico y prohíbe CR/LF en headers; probar esos valores directamente en service.
for (const value of [null, '', 'bad', key.slice(1), key + ',' + key, key.slice(0, 8) + ' ' + key.slice(9)]) test(`cancel key inválida ${JSON.stringify(value)}`, () => invalidCancel({ key: value }, 'INVALID_IDEMPOTENCY_KEY'));
for (const name of ['Idempotency-Key', 'iDEMPOTENCY-kEY']) test(`cancel key duplicada ${name}`, () => invalidCancel({ extraHeaders: [name, key] }, 'INVALID_IDEMPOTENCY_KEY'));
test('cancel nombre de header case-insensitive', async () => {
    assert.equal((await patchCancel({ keyName: 'iDEMPOTENCY-kEY' })).status, 200);
});
for (const value of [` ${key}`, `${key} `, `${key}\n`, `${key}\r`, `${key}\u0000`, 123, null]) test(`cancel service key sin coerción/trim ${JSON.stringify(value)}`, async () => {
    await assert.rejects(meetingModule('service').cancelMeeting({ actorId: actor, meetingId, idempotencyKey: value, body: cancelBody }), e => e.code === 'INVALID_IDEMPOTENCY_KEY');
    assert.equal(state.calls.length, 0);
});
for (const value of [null, [], 'text', 1, true]) test(`cancel body no objeto ${JSON.stringify(value)}`, async () => {
    assert.equal((await patchCancel({ body: value })).status, 400); assert.equal(state.calls.length, 0);
});
test('cancel JSON malformado: INVALID_JSON sin reflejar body', async () => {
    const r = await patchCancel({ raw: '{"PRIVATE":"' });
    assert.deepEqual(r, { status: 400, body: { error: { code: 'INVALID_JSON', message: 'El cuerpo JSON no es válido.' } } });
    assert.ok(!JSON.stringify([r, state.logs]).includes('PRIVATE')); assert.equal(state.calls.length, 0);
});
for (const field of ['expectedVersion', 'reason']) test(`cancel falta ${field}`, () => {
    const body = { ...cancelBody }; delete body[field]; return invalidCancel({ body });
});
for (const field of ['role', 'actorId', 'notes', 'status', 'requestHash', 'idempotencyKey', 'constructor', '__proto__', 'assignedTo', 'version', 'consultationRequestId']) {
    test(`cancel extra ${field}`, () => invalidCancel({ body: { ...cancelBody, [field]: 'PRIVATE' } }, 'INVALID_REQUEST'));
}
for (const expectedVersion of [1, 2147483647]) test(`cancel versión límite ${expectedVersion} delegada a RPC`, async () => {
    assert.equal((await patchCancel({ body: { ...cancelBody, expectedVersion } })).status, 200);
    assert.equal(state.calls[0].args.p_expected_version, expectedVersion);
});
for (const expectedVersion of [0, -1, 1.5, '1', true, false, null, 2147483648]) test(`cancel versión inválida ${JSON.stringify(expectedVersion)}`, () => invalidCancel({ body: { ...cancelBody, expectedVersion } }));
for (const reason of ['client_request', 'staff_unavailable', 'duplicate', 'administrative', 'other']) test(`cancel reason exacto ${reason}`, async () => {
    assert.equal((await patchCancel({ body: { ...cancelBody, reason } })).status, 200);
    assert.equal(state.calls[0].args.p_reason, reason);
});
for (const reason of [' client_request', 'client_request ', 'CLIENT_REQUEST', 'client-request', 'customer_request', '', null, 1, true, false, 'client_request\n', 'client_request\u0000', {}, []]) test(`cancel reason inválido ${JSON.stringify(reason)}`, () => invalidCancel({ body: { ...cancelBody, reason } }));
test('cancel normalizador estricto no ejecuta accesores ni acepta símbolos/herencia', () => {
    const { normalizeCancellation } = meetingModule('service');
    let reads = 0;
    const getter = { ...cancelBody }; Object.defineProperty(getter, 'reason', { get() { reads++; return 'other'; } });
    const setter = { ...cancelBody }; Object.defineProperty(setter, 'reason', { set(_) { reads++; } });
    const prototype = Object.create(null);
    Object.defineProperty(prototype, 'constructor', { get() { reads++; return Object; } });
    for (const candidate of [Object.assign(Object.create({}), cancelBody), Object.create(cancelBody),
        Object.assign(new Date(), cancelBody), getter, setter, { ...cancelBody, [Symbol('extra')]: 1 },
        Object.assign(Object.create(prototype), cancelBody)]) {
        assert.throws(() => normalizeCancellation(meetingId, candidate), e => e.code === 'INVALID_REQUEST');
    }
    assert.equal(reads, 0); assert.equal(state.calls.length, 0);
    assert.deepEqual(clone(normalizeCancellation(meetingId, Object.assign(Object.create(null), cancelBody))), { meetingId, ...cancelBody });
});
test('cancel normalizador UUID sin coerción y números no JSON inválidos', () => {
    const { normalizeCancellation } = meetingModule('service');
    for (const id of [null, 1, {}, ` ${meetingId}`, `${meetingId}\n`]) {
        assert.throws(() => normalizeCancellation(id, cancelBody), e => e.code === 'INVALID_MEETING_ID');
    }
    for (const expectedVersion of [undefined, NaN, Infinity, -Infinity, 1n]) {
        assert.throws(() => normalizeCancellation(meetingId, { ...cancelBody, expectedVersion }), e => e.code === 'INVALID_MEETING_INPUT');
    }
});

test('cancel hash: orden de body y casing UUID no importan', async () => {
    await patchCancel();
    assert.equal((await patchCancel({ id: meetingId.toUpperCase(), key: key.toUpperCase(), body: { reason: 'client_request', expectedVersion: 1 } })).status, 200);
    assert.deepEqual(state.calls[0], state.calls[1]);
    assert.match(state.calls[0].args.p_request_hash, /^[a-f0-9]{64}$/);
});
test('cancel hash: cada campo canónico modifica el hash', async () => {
    await patchCancel(); const baseline = state.calls[0].args.p_request_hash;
    for (const [field, value] of Object.entries({ expectedVersion: 2, reason: 'other' })) {
        await patchCancel({ body: { ...cancelBody, [field]: value } });
        assert.notEqual(state.calls.at(-1).args.p_request_hash, baseline);
    }
    state.cancelData = { ...cancelled, id: assigned };
    await patchCancel({ id: assigned }); assert.notEqual(state.calls.at(-1).args.p_request_hash, baseline);
});
test('cancel hash excluye actor y clave; actor del perfil interno', async () => {
    await patchCancel(); const baseline = state.calls[0].args.p_request_hash;
    state.profile.id = assigned; await patchCancel();
    assert.equal(state.calls[1].args.p_actor_id, assigned);
    assert.equal(state.calls[1].args.p_request_hash, baseline);
    await patchCancel({ key: actor });
    assert.equal(state.calls[2].args.p_idempotency_key, actor);
    assert.equal(state.calls[2].args.p_request_hash, baseline);
});
test('cancel service no muta inputs y realiza una sola llamada', async () => {
    const input = Object.freeze({ actorId: actor, meetingId, idempotencyKey: key, body: Object.freeze({ ...cancelBody }) });
    assert.deepEqual(clone(await meetingModule('service').cancelMeeting(input)), cancelled);
    assert.deepEqual(input.body, cancelBody); assert.equal(state.calls.length, 1); assert.deepEqual(state.queries, []);
});
test('cancel repository devuelve data sin reinterpretarla', async () => {
    const data = await meetingModule('repository').cancelConsultationMeeting({ actorId: actor, idempotencyKey: key,
        requestHash: 'synthetic-hash', payload: { meetingId, ...cancelBody } });
    assert.equal(data, state.cancelData);
    assert.deepEqual(state.calls, [{ name: 'cancel_consultation_meeting', args: {
        p_actor_id: actor, p_meeting_id: meetingId, p_idempotency_key: key, p_request_hash: 'synthetic-hash',
        p_expected_version: 1, p_reason: 'client_request',
    } }]);
    assert.deepEqual(state.queries, []);
});
test('cancel repository propaga el mismo objeto error', async () => {
    state.rpcError = { code: 'P0001', message: 'ACTOR_NOT_ALLOWED', details: 'PRIVATE' };
    await assert.rejects(meetingModule('repository').cancelConsultationMeeting({ actorId: actor, idempotencyKey: key,
        requestHash: 'synthetic-hash', payload: { meetingId, ...cancelBody } }), e => e === state.rpcError);
    assert.equal(state.calls.length, 1);
});

const cancellationMapping = {
    ACTOR_NOT_ALLOWED: [403, 'No tienes permisos para cancelar reuniones.'],
    MEETING_NOT_FOUND: [404, 'La reunión no existe.'],
    MEETING_NOT_SCHEDULED: [409, 'Solo se puede cancelar una reunión programada.'],
    MEETING_VERSION_CONFLICT: [409, 'La reunión cambió. Vuelve a consultar sus datos.'],
    IDEMPOTENCY_KEY_REUSED: [409, 'La clave de idempotencia ya corresponde a otros datos.'],
    CONSULTATION_STATE_INCONSISTENT: [409, 'La solicitud requiere revisión antes de cancelar la reunión.'],
    INVALID_MEETING_INPUT: [400, 'Los datos de la reunión no son válidos.'],
    INVALID_REQUEST: [400, 'Los datos de la solicitud no son válidos.'],
    WORKFLOW_ISOLATION_NOT_SUPPORTED: [500, 'Ocurrió un error interno en el servidor.'],
    INTERNAL_ERROR: [500, 'Ocurrió un error interno en el servidor.'],
};
for (const [code, [status, message]] of Object.entries(cancellationMapping)) test(`cancel RPC ${code}: status/code/message exactos`, async () => {
    state.rpcError = { code: 'P0001', message: code, details: 'PRIVATE_SQL', hint: 'PRIVATE_TOKEN', cause: 'PRIVATE', stack: 'PRIVATE' };
    assert.deepEqual(await patchCancel(), { status, body: { error: { code, message } } });
    assert.equal(state.calls.length, 1);
    assert.deepEqual(state.logs, status === 500 ? [[{ event: 'request_failed', statusCode: 500, code }]] : []);
});
for (const error of [{ code: '23505', message: 'MEETING_NOT_FOUND' }, { code: 'P0001', message: 'PRIVATE_UNKNOWN' },
    ...['toString', 'constructor', '__proto__'].map(message => ({ code: 'P0001', message })),
    { code: 'ACTOR_NOT_ALLOWED', statusCode: 403, message: 'PRIVATE' }]) test(`cancel allowlist rechaza ${error.code}/${error.message}`, async () => {
    state.rpcError = error; const r = await patchCancel();
    assert.deepEqual(r, { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno en el servidor.' } } });
    assert.ok(!JSON.stringify([r, state.logs]).includes('PRIVATE'));
});
test('cancel rechazo de transporte: 500 sanitizado, sin retry', async () => {
    state.rpcThrow = Object.assign(new Error('PRIVATE_SECRET'), { details: 'PRIVATE_SQL', hint: 'PRIVATE_TOKEN', cause: 'PRIVATE' });
    const r = await patchCancel();
    assert.deepEqual(r, { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno en el servidor.' } } });
    assert.equal(state.calls.length, 1); assert.ok(!JSON.stringify([r, state.logs]).includes('PRIVATE'));
});
test('cancel contexto conserva mensajes históricos de creación y schedule', async () => {
    for (const [code, message] of Object.entries({
        ACTOR_NOT_ALLOWED: 'No tienes permisos para confirmar reuniones.',
        MEETING_NOT_SCHEDULED: 'Solo se puede reprogramar una reunión programada.',
        CONSULTATION_STATE_INCONSISTENT: 'La solicitud requiere revisión antes de agendar.',
    })) {
        state.rpcError = { code: 'P0001', message: code };
        for (const r of [await send(), await patchSchedule()]) {
            assert.deepEqual(r, { status: cancellationMapping[code][0], body: { error: { code, message } } });
        }
    }
});

const invalidCancellationResponses = [null, [], {}, 'bad',
    ...Object.keys(cancelled).map(k => { const data = { ...cancelled }; delete data[k]; return data; }),
    ...Object.entries({
        id: ['bad', assigned, null], consultationRequestId: ['bad', null],
        scheduledAt: ['now', '2028-02-30T15:30:00Z', '2028-02-29T15:30:00', '2028-02-29T15:30:00.1234567Z', '2028-02-29T15:30:00+25:00', '10001-01-01T00:00:00Z', null],
        timeZone: ['', ' ', null, 1], durationMinutes: [0, -1, 1.5, '45', null, 2147483648],
        mode: ['bad', null, 1], status: ['scheduled', 'completed', 'no_show', 'CANCELLED', null, 1],
        version: [0, 1, -1, 1.5, '2', null, 2147483648],
    }).flatMap(([k, values]) => values.map(value => ({ ...cancelled, [k]: value }))),
];
for (const [i, data] of invalidCancellationResponses.entries()) test(`cancel respuesta inválida ${i}: INTERNAL_ERROR`, async () => {
    state.cancelData = data;
    assert.deepEqual(await patchCancel(), { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno en el servidor.' } } });
    assert.deepEqual(state.logs, [[{ event: 'request_failed', statusCode: 500, code: 'INTERNAL_ERROR' }]]);
});
test('cancel ocho campos, sin reason/extras; pasado y microsegundos preservados', async () => {
    const safe = { ...cancelled, scheduledAt: '2000-02-29T15:30:00.123456+00:00', version: 2147483647 };
    state.cancelData = { ...safe, reason: 'PRIVATE', notes: 'PRIVATE', assignedTo: 'PRIVATE', createdBy: 'PRIVATE',
        updatedBy: 'PRIVATE', audit: 'PRIVATE', metadata: 'PRIVATE', requestHash: 'PRIVATE', idempotency: 'PRIVATE' };
    const r = await patchCancel(); assert.deepEqual(r, { status: 200, body: { data: safe } });
    assert.equal(Object.keys(r.body.data).length, 8); assert.ok(!Object.hasOwn(r.body.data, 'reason'));
    assert.deepEqual(state.queries, ['internal_users']);
});
test('cancel replay HTTP simulado: dos respuestas y argumentos idénticos, sin retry ni nueva key', async () => {
    const first = await patchCancel(), second = await patchCancel();
    assert.deepEqual(first, { status: 200, body: { data: cancelled } }); assert.deepEqual(second, first);
    assert.equal(state.calls.length, 2); assert.deepEqual(state.calls[0], state.calls[1]);
    assert.deepEqual(state.queries, ['internal_users', 'internal_users']);
});

// Regresión P2: fecha local admitida -> UTC año 10000 -> respuesta y replay.
const boundarySchedule = { ...scheduleBody, date: '9999-12-31', time: '23:30' };
const boundaryTimestamp = '10000-01-01T04:30:00+00:00';
test('timestamp response: creación 9999 local -> 10000 UTC preserva contrato y hash', async () => {
    // Comprobación local de la conversión; la RPC se simula, no se ejecuta SQL.
    const instant = new Date('9999-12-31T23:30:00-05:00');
    assert.equal(instant.toISOString(), '+010000-01-01T04:30:00.000Z');
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Guayaquil',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
    const local = Object.fromEntries(parts.map(p => [p.type, p.value]));
    assert.deepEqual([local.year, local.month, local.day, local.hour, local.minute], ['9999', '12', '31', '23', '30']);
    const input = { ...body, date: '9999-12-31', time: '23:30' };
    state.data = { ...result, meeting: { ...rescheduled, scheduledAt: boundaryTimestamp, version: 1 } };
    assert.deepEqual(await send({ body: input }), { status: 201, body: { data: state.data } });
    assert.equal(state.calls.length, 1);
    assert.equal(state.calls[0].args.p_request_hash, createHash('sha256').update(JSON.stringify({ consultationRequestId: consultation, ...input }), 'utf8').digest('hex'));
});
test('timestamp response: reprogramación 9999 local -> 10000 UTC responde 200', async () => {
    state.scheduleData = { ...rescheduled, scheduledAt: boundaryTimestamp };
    assert.deepEqual(await patchSchedule({ body: boundarySchedule }), { status: 200, body: { data: state.scheduleData } });
    const canonical = { meetingId, expectedVersion: 1, date: '9999-12-31', time: '23:30', timeZone: 'America/Guayaquil', durationMinutes: 45, mode: 'online' };
    assert.deepEqual(state.calls, [{ name: 'reschedule_consultation_meeting', args: {
        p_actor_id: actor, p_meeting_id: meetingId, p_idempotency_key: key,
        p_request_hash: createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex'),
        p_expected_version: 1, p_scheduled_date: '9999-12-31', p_scheduled_time: '23:30',
        p_time_zone: 'America/Guayaquil', p_duration_minutes: 45, p_mode: 'online',
    } }]);
});
test('timestamp response: cancelación y replay año 10000 responden 200 idénticos', async () => {
    state.cancelData = { ...cancelled, scheduledAt: boundaryTimestamp };
    const first = await patchCancel(), second = await patchCancel();
    assert.deepEqual(first, { status: 200, body: { data: state.cancelData } });
    assert.deepEqual(second, first); assert.equal(state.calls.length, 2);
    assert.deepEqual(state.calls[0], state.calls[1]);
    assert.equal(state.calls[0].args.p_idempotency_key, key);
    assert.equal(state.calls[0].args.p_request_hash, createHash('sha256').update(JSON.stringify({ meetingId, ...cancelBody }), 'utf8').digest('hex'));
    assert.deepEqual(state.queries, ['internal_users', 'internal_users']); assert.deepEqual(state.logs, []);
});
for (const scheduledAt of [
    '10000-02-29T15:30:00.123456+00:00', '10000-01-01T00:00:00+05:00',
    '9999-12-31T23:30:00-05:00', '10000-12-31T23:59:59.999999Z',
    '2028-02-29T15:30:00+00:00', '2000-02-29T10:30:00.1-05:00',
]) test(`timestamp response válido preservado ${scheduledAt}`, async () => {
    state.cancelData = { ...cancelled, scheduledAt }; state.scheduleData = { ...rescheduled, scheduledAt };
    assert.deepEqual(await patchCancel(), { status: 200, body: { data: state.cancelData } });
    assert.deepEqual(await patchSchedule(), { status: 200, body: { data: state.scheduleData } });
});
for (const scheduledAt of [
    '10000-13-01T00:00:00Z', '10000-00-01T00:00:00Z', '10000-02-30T00:00:00Z',
    '10000-01-00T00:00:00Z', '10000-01-01T24:00:00Z', '10000-01-01T00:60:00Z',
    '10000-01-01T00:00:60Z', '10000-01-01T00:00:00+25:00', '10000-01-01T00:00:00+01:60',
    '10000-01-01T00:00:00-00:00', '10000-01-01T00:00:00+xx:00',
    '10000-01-01T00:00:00.1234567Z', '10000-01-01T00:00:00.Z', '10000-01-01T00:00:00',
    '10000-01-01T00:00:00Z\n', '10000-12-31T23:30:00-05:00',
    '10001-01-01T00:00:00Z', '010000-01-01T00:00:00Z', '+010000-01-01T00:00:00Z',
    '0000-01-01T00:00:00Z', '0001-01-01T00:00:00+01:00', '1900-02-29T00:00:00Z',
    'now', 'infinity', '-infinity', 'NaN', '', 'arbitrary',
]) test(`timestamp response inválido ${JSON.stringify(scheduledAt)}`, async () => {
    state.cancelData = { ...cancelled, scheduledAt }; state.scheduleData = { ...rescheduled, scheduledAt };
    for (const r of [await patchCancel(), await patchSchedule()]) {
        assert.deepEqual(r, { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno en el servidor.' } } });
    }
});
test('timestamp response: filtros Agenda conservan rango de cuatro dígitos', async () => {
    const r = await send({ method: 'GET', path: '/api/admin/meetings?from=9999-12-31T00:00:00Z&to=10000-01-01T00:00:00Z' });
    assert.equal(r.status, 400); assert.deepEqual(state.meetingQueries, []);
});

// 4D.3C: integración HTTP con RPC simuladas; no prueba locks ni tiempo PostgreSQL.
const outcomeMapping = {
    INVALID_REQUEST: [400, 'Los datos de la solicitud no son válidos.'],
    INVALID_MEETING_INPUT: [400, 'Los datos de la reunión no son válidos.'],
    ACTOR_NOT_ALLOWED: [403, 'No tienes permisos para registrar el resultado de esta reunión.'],
    MEETING_NOT_FOUND: [404, 'La reunión no existe.'],
    MEETING_NOT_SCHEDULED: [409, 'Solo se puede registrar el resultado de una reunión programada.'],
    MEETING_VERSION_CONFLICT: [409, 'La reunión cambió. Vuelve a consultar sus datos.'],
    CONSULTATION_STATE_INCONSISTENT: [409, 'La solicitud requiere revisión antes de registrar el resultado de la reunión.'],
    IDEMPOTENCY_KEY_REUSED: [409, 'La clave de idempotencia ya corresponde a otros datos.'],
    MEETING_TOO_EARLY: [422, 'Aún no se puede registrar este resultado de la reunión.'],
    WORKFLOW_ISOLATION_NOT_SUPPORTED: [500, 'Ocurrió un error interno en el servidor.'],
    INTERNAL_ERROR: [500, 'Ocurrió un error interno en el servidor.'],
};
const outcomeCases = [
    ['complete', 'completed', 'complete_consultation_meeting', 'completeData', 'completeMeeting', 'completeConsultationMeeting'],
    ['no-show', 'no_show', 'mark_consultation_meeting_no_show', 'noShowData', 'markMeetingNoShow', 'markConsultationMeetingNoShow'],
];
for (const [route, status, rpc, dataKey, serviceName, repositoryName] of outcomeCases) {
    const patch = (options = {}) => send({ method: 'PATCH', path: `/api/admin/meetings/${options.id ?? meetingId}/${route}`,
        body: { expectedVersion: 1 }, ...options });
    const invalidOutcome = async (options, code) => {
        const r = await patch(options);
        assert.equal(r.status, 400); if (code) assert.equal(r.body.error.code, code);
        assert.equal(state.calls.length, 0);
    };
    for (const role of ['admin', 'vendedora']) test(`outcome ${route}: ${role}, actor interno y cinco argumentos`, async () => {
        state.profile.role = role; state.profile.id = assigned;
        const r = await patch({ path: `/api/admin/meetings/${meetingId}/${route}?actorId=${actor}&role=admin`,
            extraHeaders: ['X-Actor-Id', actor, 'X-Role', 'admin'] });
        assert.deepEqual(r, { status: 200, body: { data: state[dataKey] } });
        assert.deepEqual(state.calls, [{ name: rpc, args: { p_actor_id: assigned, p_meeting_id: meetingId,
            p_idempotency_key: key, p_request_hash: createHash('sha256').update(JSON.stringify({ meetingId, expectedVersion: 1 }), 'utf8').digest('hex'),
            p_expected_version: 1 } }]);
        assert.deepEqual(state.queries, ['internal_users']);
    });
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) test(`outcome ${route}: método ${method} no registrado`, async () => {
        await assert.rejects(patch({ method }), /Non-JSON response: HTTP 404/); assert.equal(state.calls.length, 0);
    });
    test(`outcome ${route}: ruta sin id`, async () => {
        await assert.rejects(patch({ path: `/api/admin/meetings/${route}` }), /Non-JSON response: HTTP 404/);
        assert.equal(state.calls.length, 0);
    });
    test(`outcome ${route}: agendadora rechazada antes de validar entrada`, async () => {
        state.profile.role = 'agendadora';
        assert.equal((await patch({ body: { role: 'admin' }, key: null })).status, 403);
        assert.equal(state.calls.length, 0);
    });
    test(`outcome ${route}: sin autenticación`, async () => {
        assert.equal((await patch({ auth: false })).status, 401); assert.equal(state.calls.length, 0);
    });
    test(`outcome ${route}: identidad inválida`, async () => {
        const { AuthApiError } = await import('@supabase/supabase-js');
        state.authError = new AuthApiError('synthetic', 401, 'bad_jwt');
        assert.equal((await patch()).status, 401); assert.equal(state.calls.length, 0);
    });
    for (const profile of [null, { id: actor, role: 'admin', active: false }]) test(`outcome ${route}: perfil ausente/inactivo`, async () => {
        state.profile = profile; assert.equal((await patch()).status, 403); assert.equal(state.calls.length, 0);
    });
    test(`outcome ${route}: ownership y revocación rechazados por RPC`, async () => {
        state.profile.role = 'vendedora'; state.rpcError = { code: 'P0001', message: 'ACTOR_NOT_ALLOWED' };
        const r = await patch(); assert.equal(r.status, 403); assert.equal(r.body.error.code, 'ACTOR_NOT_ALLOWED');
        assert.equal(state.calls.length, 1); assert.deepEqual(state.queries, ['internal_users']);
    });
    for (const contentType of ['application/json', 'application/json; charset=utf-8']) test(`outcome ${route}: Content-Type ${contentType}`, async () => {
        assert.equal((await patch({ contentType })).status, 200);
    });
    for (const contentType of [null, 'text/plain', 'application/x-www-form-urlencoded']) test(`outcome ${route}: Content-Type inválido ${contentType}`, () => invalidOutcome({ contentType }, 'INVALID_REQUEST'));
    for (const id of ['bad', meetingId.slice(1), `%20${meetingId}`, `${meetingId}%0A`]) test(`outcome ${route}: UUID inválido ${id}`, () => invalidOutcome({ id }, 'INVALID_MEETING_ID'));
    for (const value of [null, '', 'bad', key + ',' + key]) test(`outcome ${route}: clave inválida ${value}`, () => invalidOutcome({ key: value }, 'INVALID_IDEMPOTENCY_KEY'));
    for (const name of ['Idempotency-Key', 'iDEMPOTENCY-kEY']) test(`outcome ${route}: clave duplicada ${name}`, () => invalidOutcome({ extraHeaders: [name, key] }, 'INVALID_IDEMPOTENCY_KEY'));
    test(`outcome ${route}: header case-insensitive y UUID lowercase`, async () => {
        await patch(); await patch({ id: meetingId.toUpperCase(), key: key.toUpperCase(), keyName: 'iDEMPOTENCY-kEY' });
        assert.deepEqual(state.calls[0], state.calls[1]);
    });
    for (const body of [null, [], 1, true, 'text']) test(`outcome ${route}: body no objeto ${JSON.stringify(body)}`, () => invalidOutcome({ body }));
    test(`outcome ${route}: campo requerido`, () => invalidOutcome({ body: {} }, 'INVALID_MEETING_INPUT'));
    for (const field of ['status', 'reason', 'notes', 'role', 'assigned_to', 'assignedTo', 'actor', 'actorId', 'requestHash', 'idempotencyKey', 'version', '__proto__', 'constructor']) {
        test(`outcome ${route}: extra ${field}`, () => invalidOutcome({ body: { expectedVersion: 1, [field]: 'PRIVATE' } }, 'INVALID_REQUEST'));
    }
    for (const expectedVersion of [0, -1, 1.5, '1', true, false, null, 2147483648]) test(`outcome ${route}: versión inválida ${JSON.stringify(expectedVersion)}`, () => invalidOutcome({ body: { expectedVersion } }, 'INVALID_MEETING_INPUT'));
    for (const expectedVersion of [1, 2147483647]) test(`outcome ${route}: límite válido ${expectedVersion}`, async () => {
        assert.equal((await patch({ body: { expectedVersion } })).status, 200);
        assert.equal(state.calls[0].args.p_expected_version, expectedVersion);
    });
    test(`outcome ${route}: JSON inválido sanitizado`, () => invalidOutcome({ raw: '{"PRIVATE":' }, 'INVALID_JSON'));
    test(`outcome ${route}: service rechaza números no JSON y claves sin trim/coerción`, async () => {
        const call = meetingModule('service')[serviceName];
        const input = { actorId: actor, meetingId, idempotencyKey: key, body: { expectedVersion: 1 } };
        for (const expectedVersion of [undefined, NaN, Infinity, -Infinity, 1n]) {
            await assert.rejects(call({ ...input, body: { expectedVersion } }), e => e.code === 'INVALID_MEETING_INPUT');
        }
        for (const idempotencyKey of [` ${key}`, `${key} `, `${key}\n`, null, 1]) {
            await assert.rejects(call({ ...input, idempotencyKey }), e => e.code === 'INVALID_IDEMPOTENCY_KEY');
        }
        assert.equal(state.calls.length, 0);
    });
    test(`outcome ${route}: hash cambia por meeting/version y excluye actor/key`, async () => {
        await patch(); const baseline = state.calls.at(-1).args.p_request_hash;
        await patch({ body: { expectedVersion: 2 } }); assert.notEqual(state.calls.at(-1).args.p_request_hash, baseline);
        state[dataKey] = { ...state[dataKey], id: assigned };
        await patch({ id: assigned }); assert.notEqual(state.calls.at(-1).args.p_request_hash, baseline);
        state[dataKey] = { ...state[dataKey], id: meetingId }; state.profile.id = assigned;
        await patch({ key: actor }); assert.equal(state.calls.at(-1).args.p_request_hash, baseline);
    });
    test(`outcome ${route}: inputs inmutables, repository sin queries`, async () => {
        const input = Object.freeze({ actorId: actor, meetingId, idempotencyKey: key, body: Object.freeze({ expectedVersion: 1 }) });
        assert.deepEqual(clone(await meetingModule('service')[serviceName](input)), state[dataKey]);
        assert.equal(state.calls.length, 1); assert.deepEqual(state.queries, []);
    });
    test(`outcome ${route}: repository retorna data y propaga error sin reinterpretar`, async () => {
        const call = meetingModule('repository')[repositoryName];
        const input = { actorId: actor, idempotencyKey: key, requestHash: 'synthetic-hash', payload: { meetingId, expectedVersion: 1 } };
        assert.equal(await call(input), state[dataKey]);
        state.rpcError = { code: 'P0001', message: 'ACTOR_NOT_ALLOWED' };
        await assert.rejects(call(input), e => e === state.rpcError);
        assert.deepEqual(state.queries, []); assert.equal(state.calls.length, 2);
    });
    for (const [code, [http, message]] of Object.entries(outcomeMapping)) test(`outcome ${route}: ${code} -> ${http}`, async () => {
        state.rpcError = { code: 'P0001', message: code, details: 'PRIVATE', hint: 'PRIVATE', cause: 'PRIVATE', stack: 'PRIVATE' };
        assert.deepEqual(await patch(), { status: http, body: { error: { code, message } } });
        assert.equal(state.calls.length, 1); assert.ok(!JSON.stringify(state.logs).includes('PRIVATE'));
    });
    for (const error of [{ code: '23505', message: 'MEETING_NOT_FOUND' }, { code: 'P0001', message: 'PRIVATE' },
        ...['toString', 'constructor', '__proto__'].map(message => ({ code: 'P0001', message })), { statusCode: 403, message: 'PRIVATE' }]) {
        test(`outcome ${route}: error desconocido ${error.code}/${error.message}`, async () => {
            state.rpcError = error;
            assert.deepEqual(await patch(), { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: outcomeMapping.INTERNAL_ERROR[1] } } });
            assert.ok(!JSON.stringify(state.logs).includes('PRIVATE'));
        });
    }
    test(`outcome ${route}: transporte sanitizado sin retry`, async () => {
        state.rpcThrow = Object.assign(new Error('PRIVATE'), { cause: 'PRIVATE', stack: 'PRIVATE' });
        const r = await patch(); assert.equal(r.status, 500); assert.equal(r.body.error.code, 'INTERNAL_ERROR');
        assert.equal(state.calls.length, 1); assert.ok(!JSON.stringify([r, state.logs]).includes('PRIVATE'));
    });
    const response = { ...rescheduled, status };
    const corrupt = [null, [], {}, 'bad', ...Object.keys(response).map(field => { const r = { ...response }; delete r[field]; return r; }),
        ...Object.entries({ id: ['bad', assigned], consultationRequestId: ['bad', null], scheduledAt: ['infinity', '-infinity', '2028-02-30T00:00:00Z', '2028-01-01', '2028-01-01T00:00:00.1234567Z'],
            timeZone: ['', null, 1], durationMinutes: [0, 1.5, '45', 2147483648], mode: ['bad', null],
            status: ['scheduled', 'cancelled', status === 'completed' ? 'no_show' : 'completed', null],
            version: [1, 0, 1.5, '2', null, 2147483648] }).flatMap(([field, values]) => values.map(value => ({ ...response, [field]: value })))];
    for (const [i, data] of corrupt.entries()) test(`outcome ${route}: respuesta corrupta ${i}`, async () => {
        state[dataKey] = data;
        assert.deepEqual(await patch(), { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: outcomeMapping.INTERNAL_ERROR[1] } } });
    });
    for (const scheduledAt of ['2000-02-29T15:30:00.123456+00:00', '10000-01-01T00:00:00.123456Z']) {
        test(`outcome ${route}: ocho campos y replay simulado ${scheduledAt}`, async () => {
            const safe = { ...response, scheduledAt, version: 2147483647 };
            state[dataKey] = { ...safe, reason: 'PRIVATE', notes: 'PRIVATE', assignedTo: 'PRIVATE', actor: 'PRIVATE', audit: 'PRIVATE', requestHash: 'PRIVATE' };
            const first = await patch(), second = await patch();
            assert.deepEqual(first, { status: 200, body: { data: safe } }); assert.deepEqual(second, first);
            assert.equal(Object.keys(first.body.data).length, 8);
            assert.equal(state.calls.length, 2); assert.deepEqual(state.calls[0], state.calls[1]);
            assert.deepEqual(state.queries, ['internal_users', 'internal_users']);
        });
    }
}

test('outcome normalizador: UUID, herencia, accesores y símbolos sin efectos', () => {
    const { normalizeOutcome } = meetingModule('service');
    for (const id of [null, 1, {}, ` ${meetingId}`, `${meetingId}\n`]) {
        assert.throws(() => normalizeOutcome(id, { expectedVersion: 1 }), e => e.code === 'INVALID_MEETING_ID');
    }
    let reads = 0;
    const accessor = {}; Object.defineProperty(accessor, 'expectedVersion', { get() { reads++; return 1; } });
    for (const body of [accessor, Object.create({ expectedVersion: 1 }), Object.assign(new Date(), { expectedVersion: 1 }),
        { expectedVersion: 1, [Symbol('extra')]: 1 }]) {
        assert.throws(() => normalizeOutcome(meetingId, body), e => e.code === 'INVALID_REQUEST');
    }
    assert.equal(reads, 0); assert.equal(state.calls.length, 0);
    assert.deepEqual(clone(normalizeOutcome(meetingId.toUpperCase(), { expectedVersion: 1 })), { meetingId, expectedVersion: 1 });
});

test('outcome hash excluye operación/status con ámbitos RPC distintos', async () => {
    for (const [route] of outcomeCases) {
        assert.equal((await send({ method: 'PATCH', path: `/api/admin/meetings/${meetingId}/${route}`, body: { expectedVersion: 1 } })).status, 200);
    }
    assert.equal(state.calls.length, 2); assert.notEqual(state.calls[0].name, state.calls[1].name);
    assert.deepEqual(state.calls[0].args, state.calls[1].args);
});
