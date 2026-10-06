import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { createClient, NavigatorLockAcquireTimeoutError } from '@supabase/supabase-js';
import { consultationsFixture } from './fixtures/consultations.mjs';

// DOM simulado; auth.js, crm.js y login.js se ejecutan sin modificar su código.
// Se simulan SDK, fetch, navegación y matchMedia. No se leen archivos de entorno.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const A = { access_token: 'fixture-token-A', refresh_token: 'fixture-refresh-A', user: { id: 'fixture-A' } };
const B = { access_token: 'fixture-token-B', refresh_token: 'fixture-refresh-B', user: { id: 'fixture-B' } };
const userA = { id: 'fixture-A', fullName: 'Cuenta de Prueba A', role: 'admin' };
const userB = { id: 'fixture-B', fullName: 'Cuenta de Prueba B', role: 'vendedora' };
let dom;
let context;
let viewport = 1440;
const timers = new Set();

async function includes(path) {
    let html = await readFile(path, 'utf8');
    for (const match of html.matchAll(/@@include\('([^']+)'\)/g)) {
        html = html.replace(match[0], await includes(resolve(dirname(path), match[1])));
    }
    return html;
}

async function evaluate(expression) {
    const value = await vm.runInContext(expression, context);
    return value === undefined ? undefined : structuredClone(value);
}
async function until(expression) {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error(`Timed out: ${expression}`);
}
const shellVisible = "!!document.querySelector('[data-crm-shell]') && !document.querySelector('[data-crm-shell]').hidden";
const blocked = "!!document.querySelector('[data-crm-actions]') && !document.querySelector('[data-crm-actions]').hidden";
const loginReached = "location.pathname === '/pages/login/' && !!document.querySelector('[data-destination]')";
const crmReached = "location.pathname === '/pages/crm/' && !!document.querySelector('[data-destination]')";

async function setup(options = {}, page = 'crm') {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    dom?.window.close();
    const fixture = { session: A, user: userA, responses: [], consultationResponses: [], consultations: consultationsFixture, page, ...options };
    dom = new JSDOM(await includes(join(root, 'pages', page, 'index.html')), { url: `http://localhost/pages/${page}/` });
    // jsdom no refleja inert aún; el atributo inicial y sus cambios siguen HTML.
    if (!('inert' in dom.window.HTMLElement.prototype)) {
        Object.defineProperty(dom.window.HTMLElement.prototype, 'inert', {
            get() { return this.hasAttribute('inert'); },
            set(value) { this.toggleAttribute('inert', Boolean(value)); },
        });
    }
    const sandbox = {
        document: dom.window.document,
        location: { pathname: `/pages/${page}/`, replace(path) {
            sandbox.location.pathname = path;
            const destination = dom.window.document.createElement('div');
            destination.dataset.destination = '';
            dom.window.document.body.replaceChildren(destination);
        } },
        matchMedia: () => ({ matches: viewport <= 1023, addEventListener() {} }),
        innerWidth: viewport,
        addEventListener: dom.window.addEventListener.bind(dom.window),
        MutationObserver: dom.window.MutationObserver,
        AbortController, AbortSignal: options.shortTimeout ? { any: AbortSignal.any, timeout: () => AbortSignal.timeout(100) } : AbortSignal, Response,
        setTimeout(callback, delay) {
            const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
            timers.add(timer);
            return timer;
        },
        clearTimeout,
        fixture,
    };
    sandbox.window = sandbox;
    context = vm.createContext(sandbox);
    vm.runInContext(`
        window.calls = { me: 0, refresh: 0, logout: 0, login: 0, consultations: 0 };
        window.events = [];
        window.pending = [];
        window.pendingConsultations = [];
        window.requestSignals = [];
        window.current = fixture.session;
        window.emitAuth = (event, session) => {
            current = session;
            events.forEach(callback => callback(event, session));
        };
        window.mockAuth = {
            initialize: async () => ({ error: null }),
            getSession: async () => ({ data: { session: current } }),
            onAuthStateChange: callback => {
                events.push(callback);
                return { data: { subscription: { unsubscribe() {} } } };
            },
            signInWithPassword: async () => {
                calls.login++;
                emitAuth('SIGNED_IN', fixture.loginSession);
                return { data: { session: current } };
            },
            refreshSession: async ({ refresh_token }) => {
                calls.refresh++;
                window.refreshedWith = refresh_token;
                current = { ...current, access_token: 'fixture-refreshed' };
                return { data: { session: current } };
            },
            signOut: async ({ scope }) => {
                calls.logout++;
                window.logoutScope = scope;
                if (fixture.logoutFails) return { error: { status: 500 } };
                emitAuth('SIGNED_OUT', null);
                return { data: {} };
            }
        };
        window.fetch = async (url, options) => {
            if (url === '/api/admin/consultations') {
                calls.consultations++;
                requestSignals.push(options.signal);
                window.consultationRequest = { method: options.method, cache: options.cache, authorization: options.headers.Authorization };
                const response = fixture.consultationResponses.shift() || {};
                if (response.network) throw new TypeError('Fixture network failure');
                if (response.hold) await new Promise(resolve => pendingConsultations.push(resolve));
                if (response.timeout) {
                    await new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('Fixture timeout')), { once: true }));
                }
                return new Response(JSON.stringify(response.body ?? { data: response.data ?? fixture.consultations }), { status: response.status || 200 });
            }
            if (url !== '/api/auth/me') throw new Error('Unexpected request');
            calls.me++;
            window.lastAuthorization = options.headers.Authorization;
            const response = fixture.responses.shift() || { status: 200, user: fixture.user };
            if (response.network) throw new TypeError('Simulated network failure');
            if (response.hold) await new Promise(resolve => pending.push(resolve));
            return new Response(JSON.stringify({ data: response.user || fixture.user }), {
                status: response.status || 200, headers: { 'Content-Type': 'application/json' }
            });
        };
        window.errors = [];
        addEventListener('error', e => errors.push(e.message));
        addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
        window.exposed = false;
        new MutationObserver(() => {
            const shell = document.querySelector('[data-crm-shell]');
            if (shell && !shell.hidden) exposed = true;
        }).observe(document.documentElement, { subtree: true, attributes: true });
    `, context);
    const config = new vm.SyntheticModule(['getSupabaseClient', 'withAuthMutation', 'withAuthStorageLock'], function () {
        this.setExport('getSupabaseClient', () => ({ auth: sandbox.mockAuth }));
        this.setExport('withAuthMutation', (action) => action());
        this.setExport('withAuthStorageLock', (action) => action());
    }, { context });
    const auth = new vm.SourceTextModule(await readFile(join(root, 'src/js/api/auth.js'), 'utf8'), { context });
    await auth.link(() => config);
    const module = new vm.SourceTextModule(await readFile(join(root, 'src/js/modules', `${page === 'login' ? 'login' : 'crm'}.js`), 'utf8'), { context });
    await module.link(() => auth);
    await module.evaluate();
    let hooks;
    if (page === 'crm/solicitudes') {
        const api = new vm.SourceTextModule(await readFile(join(root, 'src/js/api/internal.js'), 'utf8'), { context });
        await api.link(() => auth);
        const consultations = new vm.SourceTextModule(await readFile(join(root, 'src/js/modules/crm-consultations.js'), 'utf8'), { context });
        await consultations.link(() => api); await consultations.evaluate();
        hooks = consultations.namespace.initCRMConsultations();
    }
    module.namespace[page === 'login' ? 'initLogin' : 'initCRM'](hooks);
}
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function key(key, shiftKey = false) {
    dom.window.document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
}

after(() => {
    for (const timer of timers) clearTimeout(timer);
    dom?.window.close();
});
test('01 · sin sesión → login', async () => {
    await setup({ session: null }); await until(loginReached);
});
test('02 · sesión y /auth/me 200 muestran shell', async () => {
    await setup(); await until(shellVisible);
    assert.equal(await evaluate('calls.me'), 1);
    assert.equal(await evaluate('lastAuthorization'), `Bearer ${A.access_token}`);
    assert.deepEqual(await evaluate('errors'), []);
});
test('03 · fullName y role proceden de Express y se insertan como texto', async () => {
    await setup({ user: { ...userB, fullName: '<img src=x onerror=alert(1)> Prueba' } });
    await until(shellVisible);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-crm-name]')].map(e => e.textContent)"), Array(3).fill('<img src=x onerror=alert(1)> Prueba'));
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-crm-role]')].map(e => e.textContent)"), ['vendedora', 'vendedora']);
    assert.equal(await evaluate("document.querySelectorAll('[data-crm-name] img').length"), 0);
});
test('04 · 401 refresca una sola vez y repite GET una vez', async () => {
    await setup({ responses: [{ status: 401 }, { status: 200 }] }); await until(shellVisible);
    assert.deepEqual(await evaluate('[calls.me, calls.refresh, refreshedWith]'), [2, 1, A.refresh_token]);
});
test('05 · segundo 401 limpia localmente y vuelve a login', async () => {
    // Se retiene el logout para comprobar los contadores antes de navegar.
    await setup({ responses: [{ status: 401 }, { status: 401 }], logoutFails: true }); await until(blocked);
    assert.deepEqual(await evaluate('[calls.me, calls.refresh, calls.logout, logoutScope, exposed]'), [2, 1, 1, 'local', false]);
    await evaluate('fixture.logoutFails = false'); await click('[data-crm-actions] [data-crm-logout]'); await until(loginReached);
});
test('06 · 403 nunca muestra CRM; si falla logout permanece bloqueado', async () => {
    await setup({ responses: [{ status: 403 }], logoutFails: true }); await until(blocked);
    assert.deepEqual(await evaluate('[exposed, calls.refresh, calls.logout]'), [false, 0, 1]);
    assert.equal(await evaluate("document.querySelector('[data-crm-retry]').hidden"), true);
    await evaluate('fixture.logoutFails = false'); await click('[data-crm-actions] [data-crm-logout]'); await until(loginReached);
});
test('07 · 500 conserva sesión y permite reintentar', async () => {
    await setup({ responses: [{ status: 500 }] }); await until(blocked);
    assert.deepEqual(await evaluate('[calls.logout, exposed]'), [0, false]);
    assert.equal(await evaluate("document.querySelector('[data-crm-message]').textContent"), 'El servicio no está disponible en este momento.');
    await click('[data-crm-retry]'); await until(shellVisible);
});
test('08 · error de red bloquea sin logout', async () => {
    await setup({ responses: [{ network: true }] }); await until(blocked);
    assert.deepEqual(await evaluate('[calls.logout, exposed, !!current]'), [0, false, true]);
});
test('09 · logout correcto → login', async () => {
    await setup(); await until(shellVisible); await click('.crm-sidebar [data-crm-logout]'); await until(loginReached);
});
test('10 · cambio A → B elimina A inmediatamente y valida B', async () => {
    await setup(); await until(shellVisible);
    await evaluate(`fixture.responses.push({ hold: true, user: ${JSON.stringify(userB)} }); emitAuth('SIGNED_IN', ${JSON.stringify(B)})`);
    assert.equal(await evaluate("document.querySelector('[data-crm-shell]').hidden"), true);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-crm-name]')].map(e => e.textContent)"), ['', '', '']);
    await until('pending.length === 1'); await evaluate('pending.shift()()'); await until(shellVisible);
    assert.equal(await evaluate("document.querySelector('[data-crm-name]').textContent"), userB.fullName);
});
test('11 · respuesta antigua de A no modifica a B', async () => {
    await setup({ responses: [{ hold: true, user: userA }] }); await until('pending.length === 1');
    await evaluate(`fixture.responses.push({ user: ${JSON.stringify(userB)} }); emitAuth('SIGNED_IN', ${JSON.stringify(B)})`);
    await until(shellVisible); await evaluate('pending.shift()()');
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(await evaluate("document.querySelector('[data-crm-name]').textContent"), userB.fullName);
    assert.deepEqual(await evaluate('[calls.me, calls.logout]'), [2, 0]);
});
test('12 · SIGNED_OUT oculta inmediatamente y va al login', async () => {
    await setup(); await until(shellVisible);
    assert.equal(await evaluate("emitAuth('SIGNED_OUT', null); document.querySelector('[data-crm-shell]').hidden"), true);
    await until(loginReached);
});
test('13 · contenido protegido oculto e inert antes de 200', async () => {
    await setup({ responses: [{ hold: true }] }); await until('pending.length === 1');
    assert.deepEqual(await evaluate("[document.querySelector('[data-crm-shell]').hidden, document.querySelector('[data-crm-shell]').inert, exposed]"), [true, true, false]);
    await evaluate('pending.shift()()'); await until(shellVisible);
});
test('14 · drawer móvil, overlay, foco y fondo bloqueado', async () => {
    viewport = 390;
    await setup(); await until(shellVisible); await click('[data-crm-menu]');
    assert.deepEqual(await evaluate("[document.querySelector('[data-crm-menu]').getAttribute('aria-expanded'), document.querySelector('[data-crm-workspace]').inert, document.activeElement.hasAttribute('data-crm-close')]"), ['true', true, true]);
    await key('Tab', true);
    assert.equal(await evaluate("document.activeElement.hasAttribute('data-crm-logout')"), true);
    await click('[data-crm-overlay]');
    assert.deepEqual(await evaluate("[document.querySelector('[data-crm-menu]').getAttribute('aria-expanded'), document.querySelector('[data-crm-workspace]').inert, document.activeElement.hasAttribute('data-crm-menu')]"), ['false', false, true]);
});
test('15 · Escape cierra drawer y devuelve foco', async () => {
    viewport = 390;
    await setup(); await until(shellVisible);
    await click('[data-crm-menu]');
    await key('Escape');
    assert.deepEqual(await evaluate("[document.querySelector('[data-crm-menu]').getAttribute('aria-expanded'), document.activeElement.hasAttribute('data-crm-menu')]"), ['false', true]);
});
test('16 · módulos futuros sin enlaces ni activación de teclado', async () => {
    await setup(); await until(shellVisible);
    assert.equal(await evaluate("document.querySelectorAll('.crm-nav [aria-disabled=true]').length"), 9);
    assert.equal(await evaluate("[...document.querySelectorAll('.crm-nav [aria-disabled=true]')].every(e => !e.hasAttribute('href') && e.tabIndex === -1)"), true);
});
test('17 · Dashboard conserva aria-current entre las rutas habilitadas', async () => {
    await setup(); await until(shellVisible);
    assert.equal(await evaluate("document.querySelector('.crm-nav a').getAttribute('aria-current')"), 'page');
    assert.equal(await evaluate("document.querySelectorAll('.crm-nav a[href]').length"), 2);
});
test('18 · login autorizado redirige a CRM', async () => {
    await setup({ session: null, loginSession: A }, 'login');
    await until("!document.querySelector('[data-login-submit]').disabled");
    await evaluate("document.querySelector('[name=email]').value = 'fixture@example.invalid'; document.querySelector('[name=password]').value = 'fixture-only'; document.querySelector('form').requestSubmit()");
    await until(crmReached);
});
test('19 · restauración del login valida antes de ir al CRM', async () => {
    await setup({ responses: [{ hold: true }] }, 'login'); await until('pending.length === 1');
    assert.equal(await evaluate('location.pathname'), '/pages/login/');
    await evaluate('pending.shift()()'); await until(crmReached);
});

test('20 · 403 de A no cierra B si getSession detecta B antes del evento', async () => {
    await setup({ responses: [{ status: 403, hold: true }] }); await until('pending.length === 1');
    await evaluate(`
        let reads = 0;
        mockAuth.getSession = async () => {
            if (++reads === 2) current = ${JSON.stringify(B)};
            return { data: { session: current } };
        };
        fixture.user = ${JSON.stringify(userB)};
        pending.shift()();
    `);
    await until(shellVisible);
    assert.deepEqual(await evaluate("[calls.logout, document.querySelector('[data-crm-name]').textContent]"), [0, userB.fullName]);
});
test('21 · respuesta 401 tardía de A no refresca ni cierra B', async () => {
    await setup({ responses: [{ status: 401, hold: true }] }); await until('pending.length === 1');
    await evaluate(`fixture.user = ${JSON.stringify(userB)}; emitAuth('SIGNED_IN', ${JSON.stringify(B)})`);
    await until(shellVisible); await evaluate('pending.shift()()');
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.deepEqual(await evaluate('[calls.refresh, calls.logout]'), [0, 0]);
});
test('22 · logout fallido bloquea y permite volver a intentar', async () => {
    await setup({ logoutFails: true }); await until(shellVisible);
    await click('.crm-sidebar [data-crm-logout]'); await until(blocked);
    assert.deepEqual(await evaluate("[!!current, document.querySelector('[data-crm-shell]').hidden]"), [true, true]);
    await evaluate('fixture.logoutFails = false'); await click('[data-crm-actions] [data-crm-logout]'); await until(loginReached);
});
test('23 · bfcache oculta el shell y exige una nueva validación', async () => {
    await setup(); await until(shellVisible);
    dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide', { persisted: true }));
    assert.equal(await evaluate("document.querySelector('[data-crm-shell]').hidden"), true);
    await evaluate('fixture.responses.push({ hold: true })');
    dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true }));
    await until('pending.length === 1');
    assert.equal(await evaluate("document.querySelector('[data-crm-shell]').hidden"), true);
    await evaluate('pending.shift()()'); await until(shellVisible);
    assert.equal(await evaluate('calls.me'), 2);
});

// Dos contextos de módulo independientes representan dos pestañas. Comparten
// únicamente el almacenamiento SDK y el servicio Web Locks simulado.
function lockManager() {
    const tails = new Map();
    return {
        request(name, options, action) {
            const previous = tails.get(name);
            if (options.ifAvailable && previous) return Promise.resolve(action(null));
            const result = (previous ?? Promise.resolve()).then(() => action({ name }));
            const tail = result.catch(() => {});
            tails.set(name, tail);
            void tail.then(() => { if (tails.get(name) === tail) tails.delete(name); });
            return result;
        },
    };
}

const sdkSession = id => ({
    access_token: `fixture-sdk-${id}`, refresh_token: `fixture-sdk-refresh-${id}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600,
    token_type: 'bearer', user: { id },
});

async function sdkFixture({ supported = true } = {}) {
    const storage = new Map([['fixture-sdk', JSON.stringify(sdkSession('A'))]]);
    const clients = [];
    const events = [];
    const requests = [];
    const holds = new Map();
    const locks = supported ? lockManager() : undefined;
    const read = () => JSON.parse(storage.get('fixture-sdk') ?? 'null');
    const transport = async url => {
        const parsed = new URL(url);
        const kind = parsed.pathname.endsWith('/logout') ? 'logout' : parsed.searchParams.get('grant_type');
        if (!['logout', 'password', 'refresh_token'].includes(kind)) throw Error('Unexpected SDK request');
        requests.push(kind);
        const held = holds.get(kind);
        if (held) { held.started(); await held.wait; }
        const refreshed = { ...sdkSession('A'), access_token: 'fixture-sdk-A-rotated', refresh_token: 'fixture-sdk-refresh-A-rotated' };
        return new Response(JSON.stringify(kind === 'logout' ? {} : kind === 'password' ? sdkSession('B') : refreshed), {
            status: 200, headers: { 'Content-Type': 'application/json' },
        });
    };
    const makeTab = async () => {
        let client;
        const realm = vm.createContext({ navigator: { locks }, URL, AbortSignal, TypeError,
            fetch: async () => new Response(JSON.stringify({ data: {
                id: read()?.user.id, fullName: `Perfil ${read()?.user.id}`, role: 'admin',
            } }), { status: 200 }),
        });
        const sdk = new vm.SyntheticModule(['createClient', 'NavigatorLockAcquireTimeoutError'], function () {
            this.setExport('NavigatorLockAcquireTimeoutError', NavigatorLockAcquireTimeoutError);
            this.setExport('createClient', (url, key, options) => {
                client = createClient(url, key, { ...options, global: { fetch: transport }, auth: {
                    ...options.auth, autoRefreshToken: false, storageKey: 'fixture-sdk',
                    storage: { getItem: key => storage.get(key) ?? null,
                        setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
                } });
                clients.push(client);
                return client;
            });
        }, { context: realm });
        const config = new vm.SourceTextModule(await readFile(join(root, 'src/config/supabase.js'), 'utf8'), {
            context: realm, initializeImportMeta(meta) {
                meta.env = { VITE_SUPABASE_URL: 'https://fixture.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture-only' };
            },
        });
        await config.link(() => sdk);
        const api = new vm.SourceTextModule(await readFile(join(root, 'src/js/api/auth.js'), 'utf8'), { context: realm });
        await api.link(() => config); await api.evaluate();
        if (supported) {
            await api.namespace.getSession();
            // Equivalente a BroadcastChannel: entrega remota, sin esperar desde
            // el callback Auth. No se reemiten eventos recibidos por el peer.
            client.auth.onAuthStateChange((event, session) => {
                if (!['SIGNED_IN', 'SIGNED_OUT'].includes(event)) return;
                events.push(event);
                for (const peer of clients) if (peer !== client) {
                    queueMicrotask(() => {
                        for (const subscriber of peer.auth.stateChangeEmitters.values()) {
                            if (subscriber.callback.__fixtureBridge) continue;
                            subscriber.callback(event, session);
                        }
                    });
                }
            }).data.subscription.callback.__fixtureBridge = true;
        }
        return { api: api.namespace, realm, apiModule: api, client };
    };
    return {
        makeTab, read, requests, events,
        hold(kind) {
            let started, release;
            const reached = new Promise(resolve => { started = resolve; });
            const wait = new Promise(resolve => { release = resolve; });
            holds.set(kind, { started, wait });
            return { reached, release };
        },
        async close() { for (const client of clients) await client.auth.stopAutoRefresh(); },
    };
}

test('24 · SDK real: logout A pendiente + login B en otra pestaña conserva B', { timeout: 5000 }, async () => {
    const fixture = await sdkFixture();
    const a = await fixture.makeTab(), b = await fixture.makeTab();
    const held = fixture.hold('logout');
    const closing = a.api.signOut({ session: await a.api.getSession(), isCurrent: () => true });
    await held.reached;
    const entering = b.api.signIn('fixture@example.invalid', 'fixture-only');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(fixture.requests, ['logout']);
    held.release(); await closing; await entering;
    assert.equal((await b.api.getSession()).user.id, 'B');
    assert.deepEqual(fixture.events, ['SIGNED_OUT', 'SIGNED_IN']);
    await fixture.close();
});

test('25 · SDK real y CRM: B espera y ningún SIGNED_OUT tardío desautoriza su UI', { timeout: 5000 }, async () => {
    const fixture = await sdkFixture();
    const a = await fixture.makeTab(), b = await fixture.makeTab();
    const page = new JSDOM(await includes(join(root, 'pages/crm/index.html')));
    let redirected = false;
    Object.assign(a.realm, {
        document: page.window.document, window: { matchMedia: () => ({ matches: false, addEventListener() {} }),
            addEventListener() {}, location: { pathname: '/pages/crm/', replace() { redirected = true; } } },
        AbortController, setTimeout, clearTimeout,
    });
    const module = new vm.SourceTextModule(await readFile(join(root, 'src/js/modules/crm.js'), 'utf8'), { context: a.realm });
    await module.link(() => a.apiModule); await module.evaluate(); module.namespace.initCRM();
    const waitFor = async fn => { for (let i = 0; i < 200; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 5)); } throw Error('UI timeout'); };
    await waitFor(() => !page.window.document.querySelector('[data-crm-shell]').hidden);
    const held = fixture.hold('logout');
    page.window.document.querySelector('.crm-sidebar [data-crm-logout]').click();
    await held.reached;
    const entering = b.api.signIn('fixture@example.invalid', 'fixture-only');
    held.release(); await entering;
    await waitFor(() => page.window.document.querySelector('[data-crm-name]').textContent === 'Perfil B');
    assert.equal(redirected, false);
    assert.equal(fixture.read().user.id, 'B');
    page.window.close(); await fixture.close();
});

test('26 · SDK real: login B primero y logout legítimo posterior termina sin sesión', { timeout: 5000 }, async () => {
    const fixture = await sdkFixture();
    const a = await fixture.makeTab(), b = await fixture.makeTab();
    const held = fixture.hold('password');
    const entering = b.api.signIn('fixture@example.invalid', 'fixture-only');
    await held.reached;
    const closing = a.api.getSession().then(session => a.api.signOut({ session, isCurrent: () => true }));
    held.release(); await entering; await closing;
    assert.equal(fixture.read(), null);
    assert.deepEqual(fixture.events, ['SIGNED_IN', 'SIGNED_OUT']);
    await fixture.close();
});

test('27 · SDK real: refresh interno y logout se serializan por almacenamiento', { timeout: 5000 }, async () => {
    const fixture = await sdkFixture();
    const a = await fixture.makeTab(), b = await fixture.makeTab();
    const held = fixture.hold('refresh_token');
    const refreshing = a.client.auth.refreshSession();
    await held.reached;
    const closing = b.api.getSession().then(session => b.api.signOut({ session, isCurrent: () => true }));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(fixture.requests, ['refresh_token']);
    held.release(); await refreshing; await closing;
    assert.equal(fixture.read(), null);
    assert.deepEqual(fixture.requests, ['refresh_token', 'logout']);
    await fixture.close();
});

test('28 · callbacks SIGNED_IN/SIGNED_OUT síncronos no bloquean restores en cola', { timeout: 5000 }, async () => {
    const fixture = await sdkFixture();
    const a = await fixture.makeTab();
    const restores = [];
    a.api.onAuthSessionChange(() => { restores.push(a.api.getSession()); });
    await a.api.signIn('fixture@example.invalid', 'fixture-only');
    await a.api.signOut({ session: await a.api.getSession(), isCurrent: () => true });
    await Promise.all(restores);
    assert.equal(restores.length, 2);
    assert.equal(fixture.read(), null);
    await fixture.close();
});

test('29 · sin Web Locks falla cerrado, sin crear cliente ni modificar sesión', async () => {
    const fixture = await sdkFixture({ supported: false });
    const a = await fixture.makeTab();
    await assert.rejects(a.api.signIn('fixture@example.invalid', 'fixture-only'), { code: 'unavailable' });
    await assert.rejects(a.api.getSession(), { code: 'unavailable' });
    assert.equal(fixture.read().user.id, 'A');
    assert.equal(fixture.requests.length, 0);
});

test('30 · limpieza obsoleta de A en cola detrás de login B se descarta', { timeout: 5000 }, async () => {
    const fixture = await sdkFixture();
    const a = await fixture.makeTab(), b = await fixture.makeTab();
    const old = await a.api.getSession();
    const held = fixture.hold('password');
    const entering = b.api.signIn('fixture@example.invalid', 'fixture-only');
    await held.reached;
    const rejected = assert.rejects(a.api.signOut({ session: old, isCurrent: () => true }), { code: 'stale' });
    held.release(); await entering; await rejected;
    assert.equal(fixture.read().user.id, 'B');
    assert.deepEqual(fixture.requests, ['password']);
    await fixture.close();
});

test('31 · refresh interno pendiente impide que signIn escriba concurrentemente', { timeout: 5000 }, async () => {
    const fixture = await sdkFixture();
    const a = await fixture.makeTab(), b = await fixture.makeTab();
    const held = fixture.hold('refresh_token');
    const refreshing = a.client.auth.refreshSession();
    await held.reached;
    const entering = b.api.signIn('fixture@example.invalid', 'fixture-only');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(fixture.requests, ['refresh_token']);
    held.release(); await refreshing; await entering;
    assert.equal(fixture.read().user.id, 'B');
    assert.deepEqual(fixture.requests, ['refresh_token', 'password']);
    await fixture.close();
});

const loaded = "!document.querySelector('[data-consultations-summary]').hidden";
const loadError = "!document.querySelector('[data-consultations-retry]').hidden";
const rowText = "document.querySelector('[data-consultations-rows]').textContent";
const inbox = options => setup(options, 'crm/solicitudes');

test('32 · Solicitudes espera autorización del shell', async () => {
    await inbox({ responses: [{ hold: true }] }); await until('pending.length === 1');
    assert.equal(await evaluate('calls.consultations'), 0);
    await evaluate('pending.shift()()'); await until(loaded);
    assert.equal(await evaluate('calls.consultations'), 1);
});
test('33 · 200 renderiza contrato real, resumen y GET autenticado', async () => {
    await inbox(); await until(loaded);
    assert.match(await evaluate(rowText), /Solicitante de Prueba 1/);
    assert.match(await evaluate(rowText), /Programa de idiomas de prueba/);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-count]')].map(e => e.textContent)"), ['3', '1', '1', '1']);
    assert.deepEqual(await evaluate('consultationRequest'), { method: 'GET', cache: 'no-store', authorization: `Bearer ${A.access_token}` });
    assert.doesNotMatch(await evaluate(rowText), /fixture-request|fixture-program/);
});
test('34 · data vacío muestra empty state y resumen en cero', async () => {
    await inbox({ consultations: [] }); await until(loaded);
    assert.equal(await evaluate("document.querySelector('[data-consultations-status]').textContent"), 'No hay solicitudes registradas todavía.');
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-count]')].map(e => e.textContent)"), ['0', '0', '0', '0']);
});
test('35 · email/message null se presentan como raya', async () => {
    await inbox({ consultations: [consultationsFixture[1]] }); await until(loaded);
    assert.doesNotMatch(await evaluate(rowText), /null|undefined/);
    assert.equal(await evaluate("document.querySelector('[data-consultations-rows] details p').textContent"), '—');
});
test('36 · estados reales se traducen', async () => {
    await inbox(); await until(loaded);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.consultations-badge')].map(e => e.textContent)"), ['Pendiente', 'Convertida', 'Cancelada']);
});
test('37 · modalidades reales se traducen', async () => {
    await inbox(); await until(loaded);
    for (const mode of ['En línea', 'Teléfono', 'Oficina']) assert.ok((await evaluate(rowText)).includes(mode));
});
test('38 · 500 conserva shell y sesión, borra resultados anteriores', async () => {
    await inbox(); await until(loaded);
    await evaluate('fixture.consultationResponses.push({ status: 500 })'); await click('[data-consultations-refresh]'); await until(loadError);
    assert.equal(await evaluate(rowText), '');
    assert.equal(await evaluate(shellVisible), true);
    assert.deepEqual(await evaluate('[calls.logout, !!current]'), [0, true]);
    assert.equal(await evaluate("document.querySelector('[data-consultations-status]').textContent"), 'No fue posible cargar las solicitudes.');
});
test('39 · red muestra error recuperable', async () => {
    await inbox({ consultationResponses: [{ network: true }] }); await until(loadError);
    assert.equal(await evaluate(shellVisible), true);
    assert.equal(await evaluate('calls.logout'), 0);
});
test('40 · Reintentar vuelve a consultar', async () => {
    await inbox({ consultationResponses: [{ status: 500 }] }); await until(loadError);
    await click('[data-consultations-retry]'); await until(loaded);
    assert.equal(await evaluate('calls.consultations'), 2);
});
test('41 · Actualizar evita doble request y muestra disabled/aria-busy', async () => {
    await inbox(); await until(loaded);
    await evaluate('fixture.consultationResponses.push({ hold: true })');
    await click('[data-consultations-refresh]'); await click('[data-consultations-refresh]');
    await until('pendingConsultations.length === 1');
    assert.deepEqual(await evaluate("[calls.consultations, document.querySelector('[data-consultations-refresh]').disabled, document.querySelector('[data-consultations-refresh]').getAttribute('aria-busy')]"), [2, true, 'true']);
    assert.equal(await evaluate("document.querySelector('[data-consultations-status]').textContent"), 'Cargando solicitudes…');
    await evaluate('pendingConsultations.shift()()'); await until(loaded);
});
test('42 · respuesta vieja A no renderiza sobre B aunque transporte ignore abort', async () => {
    await inbox({ consultationResponses: [{ hold: true, data: [{ ...consultationsFixture[0], fullName: 'Solicitud A' }] }] });
    await until('pendingConsultations.length === 1');
    await evaluate(`fixture.consultations = [{ fullName: 'Solicitud B' }]; emitAuth('SIGNED_IN', ${JSON.stringify(B)})`);
    await until(loaded); await evaluate('pendingConsultations.shift()()');
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.match(await evaluate(rowText), /Solicitud B/);
    assert.doesNotMatch(await evaluate(rowText), /Solicitud A/);
    assert.equal(await evaluate('requestSignals[0].aborted'), true);
});
test('43 · A → B limpia inmediatamente filas y resumen antes de autorizar B', async () => {
    await inbox(); await until(loaded);
    await evaluate(`fixture.responses.push({ hold: true }); emitAuth('SIGNED_IN', ${JSON.stringify(B)})`);
    assert.equal(await evaluate(rowText), '');
    assert.equal(await evaluate(loaded), false);
    await until('pending.length === 1');
    assert.equal(await evaluate('calls.consultations'), 1);
    await evaluate('pending.shift()()'); await until(loaded);
});
test('44 · Dashboard activo en su ruta', async () => {
    await setup(); await until(shellVisible);
    assert.equal(await evaluate("document.querySelector('.crm-nav [aria-current]').getAttribute('href')"), '/pages/crm/');
    assert.equal(await evaluate("document.querySelectorAll('.crm-nav [aria-current]').length"), 1);
});
test('45 · Solicitudes activa en su ruta', async () => {
    await inbox(); await until(loaded);
    assert.equal(await evaluate("document.querySelector('.crm-nav [aria-current]').getAttribute('href')"), '/pages/crm/solicitudes/');
    assert.equal(await evaluate("document.querySelectorAll('.crm-nav [aria-current]').length"), 1);
});
test('46 · nueve módulos futuros deshabilitados; Solicitudes es enlace real', async () => {
    await inbox(); await until(loaded);
    assert.equal(await evaluate("document.querySelectorAll('.crm-nav [aria-disabled=true]').length"), 9);
    assert.equal(await evaluate("document.querySelector('.crm-nav a[href=\"/pages/crm/solicitudes/\"]').textContent"), 'Solicitudes');
});
test('47 · HTML malicioso es texto en todos los campos de usuario', async () => {
    const evil = '<img src=x onerror=alert(1)><script>evil()</script>';
    await inbox({ consultations: [{ ...consultationsFixture[0], fullName: evil, phone: evil, email: evil, city: evil, message: evil, program: { name: evil } }] });
    await until(loaded);
    assert.equal(await evaluate("document.querySelectorAll('[data-consultations-rows] img, [data-consultations-rows] script').length"), 0);
    assert.equal((await evaluate(rowText)).split(evil).length - 1, 6);
});
test('48 · fecha calendario conserva día; createdAt usa Ecuador', async () => {
    await inbox({ consultations: [{ ...consultationsFixture[0], preferredDate: '2026-01-01', createdAt: '2026-01-01T02:30:00Z' }] }); await until(loaded);
    assert.match(await evaluate(rowText), /01\/01\/2026/);
    assert.match(await evaluate(rowText), /31\/12\/2025/);
});
test('49 · bfcache invalida bandeja hasta nueva autorización', async () => {
    await inbox(); await until(loaded);
    dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide', { persisted: true }));
    assert.equal(await evaluate(rowText), '');
    await evaluate('fixture.responses.push({ hold: true })');
    dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true }));
    await until('pending.length === 1');
    assert.equal(await evaluate('calls.consultations'), 1);
    assert.equal(await evaluate(loaded), false);
    await evaluate('pending.shift()()'); await until(loaded);
    assert.equal(await evaluate('calls.consultations'), 2);
});
for (const status of [401, 403]) {
    test(`${status} · bloquea shell sin loop; reintento manual revalida primero`, async () => {
        await inbox(); await until(loaded);
        await evaluate(`fixture.consultationResponses.push({ status: ${status} })`);
        await click('[data-consultations-refresh]'); await until(blocked);
        assert.equal(await evaluate(rowText), '');
        assert.equal(await evaluate(shellVisible), false);
        await new Promise(resolve => setTimeout(resolve, 30));
        assert.deepEqual(await evaluate('[calls.consultations, calls.me, calls.refresh, calls.logout]'), [2, 1, 0, 0]);
        await evaluate('fixture.responses.push({ hold: true })'); await click('[data-crm-retry]');
        await until('pending.length === 1');
        assert.equal(await evaluate('calls.consultations'), 2);
        await evaluate('pending.shift()()'); await until(loaded);
        assert.equal(await evaluate('calls.consultations'), 3);
    });
}
test('52 · rechazo viejo A no bloquea B sin evento Auth todavía', async () => {
    await inbox({ consultationResponses: [{ status: 403, hold: true }] }); await until('pendingConsultations.length === 1');
    await evaluate(`current = ${JSON.stringify(B)}; fixture.consultations = [{ fullName: 'Solicitud B' }]; pendingConsultations.shift()()`);
    await until(loaded);
    assert.match(await evaluate(rowText), /Solicitud B/);
    assert.equal(await evaluate('calls.logout'), 0);
    assert.equal(await evaluate('calls.me'), 2);
});
test('53 · logout y respuesta pendiente no dejan datos en DOM', async () => {
    await inbox({ consultationResponses: [{ hold: true }] }); await until('pendingConsultations.length === 1');
    await click('.crm-sidebar [data-crm-logout]'); await until(loginReached);
    await evaluate('pendingConsultations.shift()()');
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(await evaluate("document.body.textContent.includes('Solicitante de Prueba')"), false);
});
test('54 · cuerpo inválido produce error, no vacío ni resumen inventado', async () => {
    await inbox({ consultationResponses: [{ body: { data: null } }] }); await until(loadError);
    assert.equal(await evaluate(loaded), false);
    assert.equal(await evaluate('calls.logout'), 0);
});

test('55 · timeout permite reintentar sin cerrar sesión ni recargar en bucle', async () => {
    await inbox({ shortTimeout: true, consultationResponses: [{ timeout: true }] }); await until(loadError);
    assert.equal(await evaluate(shellVisible), true);
    assert.deepEqual(await evaluate('[calls.consultations, calls.logout, calls.me]'), [1, 0, 1]);
    await click('[data-consultations-retry]'); await until(loaded);
});

// internal.js y auth.js originales; solo se retiene la respuesta del SDK.
async function sessionWaitFixture(holdRead = 1) {
    let reads = 0;
    let fetches = 0;
    let active = 0;
    let release;
    let fail;
    let reached;
    const listeners = new Set();
    const held = new Promise(resolve => { reached = resolve; });
    let tail = Promise.resolve();
    const coordinate = action => {
        const result = tail.then(async () => {
            active += 1;
            try { return await action(); } finally { active -= 1; }
        });
        tail = result.catch(() => {});
        return result;
    };
    const realm = vm.createContext({
        AbortSignal: {
            any(signals) {
                const signal = AbortSignal.any(signals);
                const add = signal.addEventListener.bind(signal);
                const remove = signal.removeEventListener.bind(signal);
                signal.addEventListener = (type, listener, options) => {
                    if (type === 'abort') listeners.add(listener);
                    add(type, listener, options);
                };
                signal.removeEventListener = (type, listener, options) => {
                    if (type === 'abort') listeners.delete(listener);
                    remove(type, listener, options);
                };
                return signal;
            },
            timeout: () => AbortSignal.timeout(30),
        },
        fetch: async () => { fetches += 1; return new Response('{"data":[]}', { status: 200 }); },
    });
    const config = new vm.SyntheticModule(['getSupabaseClient', 'withAuthMutation', 'withAuthStorageLock'], function () {
        this.setExport('getSupabaseClient', () => ({ auth: { getSession: async () => {
            reads += 1;
            if (reads === holdRead) {
                await new Promise((resolve, reject) => { release = resolve; fail = reject; reached(); });
            }
            return { data: { session: A } };
        } } }));
        this.setExport('withAuthMutation', coordinate);
        this.setExport('withAuthStorageLock', coordinate);
    }, { context: realm });
    const auth = new vm.SourceTextModule(await readFile(join(root, 'src/js/api/auth.js'), 'utf8'), { context: realm });
    await auth.link(() => config);
    const api = new vm.SourceTextModule(await readFile(join(root, 'src/js/api/internal.js'), 'utf8'), { context: realm });
    await api.link(() => auth); await api.evaluate();
    const controller = new AbortController();
    const guard = new AbortController();
    return {
        controller, guard, held, auth: auth.namespace,
        start: () => api.namespace.getInternal('/api/admin/consultations', {
            session: A, signal: guard.signal, isCurrent: () => true,
        }, controller.signal).then(() => 'resolved', error => error.code),
        release: () => release?.(), fail: () => fail?.(new Error('Fixture SDK failure')),
        state: () => ({ reads, fetches, active }),
        listenerCount: () => listeners.size,
    };
}
async function boundedResult(promise) {
    let timer;
    try {
        return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve('still-pending'), 200); })]);
    } finally { clearTimeout(timer); }
}
for (const [number, holdRead, abort] of [[56, 1, false], [57, 2, false], [58, 1, true], [59, 2, true]]) {
    test(`${number} · getSession ${holdRead === 1 ? 'inicial' : 'final'} pendiente: ${abort ? 'abort → stale' : 'timeout'}`, async () => {
        const fixture = await sessionWaitFixture(holdRead);
        const result = fixture.start();
        try {
            await fixture.held;
            if (abort) fixture.controller.abort();
            assert.equal(await boundedResult(result), abort ? 'stale' : 'timeout');
            assert.equal(fixture.state().fetches, holdRead - 1);
        } finally { fixture.release(); await result; }
    });
}

test('60 · getSession A termina o rechaza tarde sin render sobre B ni rejection no manejada', async () => {
    for (const rejects of [false, true]) {
        await inbox(); await until(loaded);
        await evaluate(`
            window.releaseSession = null;
            let first = true;
            mockAuth.getSession = async () => {
                if (first) {
                    first = false;
                    await new Promise((resolve, reject) => { releaseSession = () => ${rejects ? "reject(new Error('Fixture late failure'))" : 'resolve()'}; });
                    return { data: { session: fixture.session } };
                }
                return { data: { session: current } };
            };
            void 0;
        `);
        await click('[data-consultations-refresh]'); await until('!!releaseSession');
        await evaluate(`fixture.consultations = [{ fullName: 'Solicitud B' }]; emitAuth('SIGNED_IN', ${JSON.stringify(B)})`);
        await until(loaded);
        const before = await evaluate("[document.querySelector('[data-consultations-rows]').textContent, document.querySelector('[data-consultations-status]').textContent, document.querySelector('[data-count=total]').textContent]");
        await evaluate('releaseSession()'); await new Promise(resolve => setTimeout(resolve, 30));
        assert.deepEqual(await evaluate("[document.querySelector('[data-consultations-rows]').textContent, document.querySelector('[data-consultations-status]').textContent, document.querySelector('[data-count=total]').textContent]"), before);
        assert.deepEqual(await evaluate('errors'), []);
    }
});

test('61 · timeout no libera coordinación Auth: la operación subyacente conserva su turno', async () => {
    const fixture = await sessionWaitFixture();
    const result = fixture.start();
    try {
        await fixture.held;
        assert.equal(await boundedResult(result), 'timeout');
        const next = fixture.auth.getSession();
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.deepEqual(fixture.state(), { reads: 1, fetches: 0, active: 1 });
        fixture.release();
        assert.equal((await next).user.id, A.user.id);
        assert.deepEqual(fixture.state(), { reads: 2, fetches: 0, active: 0 });
    } finally { fixture.release(); await result; }
});

test('62 · timeout de sesión inicial/final libera UI y admite retry sin efectos tardíos', async () => {
    for (const holdRead of [1, 2]) {
        await inbox({ shortTimeout: true }); await until(loaded);
        await evaluate(`
            let reads = 0;
            window.releaseSession = null;
            mockAuth.getSession = async () => {
                if (++reads === ${holdRead}) await new Promise(resolve => { releaseSession = resolve; });
                return { data: { session: current } };
            };
            void 0;
        `);
        await click('[data-consultations-refresh]'); await until('!!releaseSession'); await until(loadError);
        assert.equal(await evaluate(shellVisible), true);
        assert.deepEqual(await evaluate("[document.querySelector('[data-consultations-refresh]').disabled, document.querySelector('[data-consultations-refresh]').getAttribute('aria-busy'), calls.logout, !!current]"), [false, 'false', 0, true]);
        assert.equal(await evaluate(rowText), '');
        await evaluate('releaseSession()'); await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(await evaluate(rowText), '');
        await click('[data-consultations-retry]'); await until(loaded);
    }
});

test('63 · señales ya abortadas y abort del guard terminan como stale', async () => {
    for (const source of ['controller', 'guard']) {
        const early = await sessionWaitFixture(); early[source].abort();
        assert.equal(await early.start(), 'stale');
        assert.equal(early.state().reads, 0);
        const fixture = await sessionWaitFixture(); const result = fixture.start();
        try {
            await fixture.held; fixture[source].abort();
            assert.equal(await boundedResult(result), 'stale');
            fixture.fail();
        } finally { fixture.release(); await result; }
    }
});

test('64 · espera retira listeners al resolver, rechazar, cancelar o vencer', async () => {
    for (const action of ['resolve', 'reject', 'abort', 'timeout']) {
        const fixture = await sessionWaitFixture(); const result = fixture.start();
        try {
            await fixture.held;
            assert.equal(fixture.listenerCount(), 1);
            if (action === 'resolve') fixture.release();
            if (action === 'reject') fixture.fail();
            if (action === 'abort') fixture.controller.abort();
            assert.equal(await boundedResult(result), { resolve: 'resolved', reject: 'expired', abort: 'stale', timeout: 'timeout' }[action]);
            assert.equal(fixture.listenerCount(), 0);
            if (['abort', 'timeout'].includes(action)) fixture.fail();
        } finally { fixture.release(); await result; }
    }
});
