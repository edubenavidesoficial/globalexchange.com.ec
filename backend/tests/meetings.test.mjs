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
        assert.ok(['internal_users', 'consultation_requests'].includes(table), 'Unexpected direct table access');
        const operations = [];
        const query = {
            select(columns) { operations.push(['select', columns]); return query; },
            eq(field, value) { operations.push(['eq', field, value]); return query; },
            async maybeSingle() {
                assert.deepEqual(operations, [['select', 'id, full_name, role, active'], ['eq', 'id', actor]]);
                return { data: state.profile, error: null };
            },
            order(field, options) { operations.push(['order', field, clone(options)]); return query; },
            then(resolve, reject) {
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
        return { data: state.data, error: state.rpcError };
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
        calls: [], queries: [], authCalls: 0, logs: [], data: clone(result), listQueries: [], saleswomen: [] };
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
