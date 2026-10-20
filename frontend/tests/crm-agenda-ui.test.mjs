import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { agendaFixture } from './fixtures/agenda.mjs';

// Agenda y diálogo reales; API simulada sin Auth SDK, HTTP ni credenciales.
// Los eventos de guard se prueban además con el shell real en crm-shell.
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
const windows = [];
afterEach(() => { for (const window of windows.splice(0)) window.close(); });

async function setup({ role = 'admin', data = agendaFixture() } = {}) {
    const dom = new JSDOM(await source('src/components/pages/crm/CRM_Agenda.html'));
    windows.push(dom.window);
    const document = dom.window.document;
    dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
    const context = vm.createContext({ document, Intl, Date, AbortController });
    const requests = [], gets = [], outcomes = [], loads = [], cancellations = [], cancelOutcomes = [];
    let keys = 0, active = true, blocks = 0, revalidations = 0, hooks;
    const access = { user: { id: 'A', role }, isCurrent: () => active,
        blockAccess() { blocks++; active = false; hooks.onInvalidate(); },
        revalidate() { revalidations++; active = false; hooks.onInvalidate(); } };
    const api = new vm.SyntheticModule(['getAgendaMeetings', 'rescheduleMeeting', 'cancelMeeting', 'createMeetingIdempotencyKey'], function () {
        this.setExport('getAgendaMeetings', async options => {
            gets.push(options);
            const next = loads.shift();
            if (next instanceof Error) throw next;
            return next === undefined ? data : await next;
        });
        this.setExport('rescheduleMeeting', async options => {
            requests.push(options);
            const next = outcomes.shift();
            if (next instanceof Error) throw next;
            return await next;
        });
        this.setExport('cancelMeeting', async options => {
            cancellations.push(options);
            const next = cancelOutcomes.shift();
            if (next instanceof Error) throw next;
            return await next;
        });
        this.setExport('createMeetingIdempotencyKey', () => `fixture-key-${++keys}`);
    }, { context });
    const dates = new vm.SourceTextModule(await source('src/js/modules/crm-agenda-date.js'), { context });
    await dates.link(() => { throw Error('Unexpected import'); });
    const dialogModule = new vm.SourceTextModule(await source('src/js/modules/crm-reschedule-dialog.js'), { context });
    await dialogModule.link(() => api);
    const cancelModule = new vm.SourceTextModule(await source('src/js/modules/crm-cancel-dialog.js'), { context });
    await cancelModule.link(() => api);
    const agenda = new vm.SourceTextModule(await source('src/js/modules/crm-agenda.js'), { context });
    await agenda.link(path => path.endsWith('meetings.js') ? api : path.endsWith('crm-reschedule-dialog.js') ? dialogModule : path.endsWith('crm-cancel-dialog.js') ? cancelModule : dates);
    await agenda.evaluate();
    hooks = agenda.namespace.initCRMAgenda();
    hooks.onAuthorized(access); await settle();
    const q = selector => document.querySelector(selector);
    const r = name => q(`[data-reschedule-${name}]`);
    const field = name => r('form').elements.namedItem(name);
    const submit = () => r('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    const c = name => q(`[data-cancel-${name}]`);
    return { c, cancellations, cancelOutcomes,
        cancelOpen() { q('[data-agenda-cancel]')?.click(); },
        cancelSubmit() { c('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); },
        cancelEscape() { c('dialog').dispatchEvent(new dom.window.Event('cancel', { cancelable: true })); },
        dom, document, q, r, field, access, requests, gets, outcomes, loads, hooks,
        get keys() { return keys; }, get blocks() { return blocks; }, get revalidations() { return revalidations; },
        open() { q('[data-agenda-reschedule]')?.click(); }, submit,
        invalidate() { active = false; hooks.onInvalidate(); },
        authorize(next = access) { active = true; hooks.onAuthorized(next); },
        escape() { r('dialog').dispatchEvent(new dom.window.Event('cancel', { cancelable: true })); },
    };
}
const error = (code, status, domainCode) => Object.assign(new Error('SECRET provider details'), { code, status, domainCode });

for (const role of ['admin', 'agendadora']) test(`4D.1D: ${role}, solo scheduled, prefill y foco`, async () => {
    const data = agendaFixture();
    data[0].scheduledAt = '2026-10-14T02:15:00Z'; data[0].durationMinutes = 17; data[0].mode = 'phone';
    const ui = await setup({ role, data });
    assert.equal(ui.q('[data-agenda-reschedule]').tagName, 'BUTTON');
    assert.equal(ui.document.querySelectorAll('[data-agenda-reschedule]').length, 1);
    ui.open();
    assert.equal(ui.r('dialog').open, true);
    assert.deepEqual(['date', 'time', 'durationMinutes', 'mode'].map(name => ui.field(name).value), ['2026-10-13', '21:15', '17', 'phone']);
    assert.equal(ui.document.activeElement, ui.field('date'));
    assert.equal(ui.keys, 0);
    ui.field('time').value = '10:00'; assert.equal(ui.keys, 0);
    assert.match(ui.r('zone').textContent, /America\/Guayaquil/);
});
test('4D.1D: vendedora no tiene acción ni submit utilizable', async () => {
    const ui = await setup({ role: 'vendedora' });
    assert.equal(ui.q('[data-agenda-reschedule]'), null);
    ui.open(); ui.submit(); ui.r('confirm').click(); ui.escape();
    assert.equal(ui.r('dialog').open, false); assert.equal(ui.requests.length, 0); assert.equal(ui.keys, 0);
});
test('4D.1D: conserva una zona diferente a Ecuador', async () => {
    const data = agendaFixture(); data[0].timeZone = 'Asia/Tokyo'; data[0].scheduledAt = '2026-10-13T23:20:00Z';
    const ui = await setup({ data }); ui.open();
    assert.equal(ui.field('date').value, '2026-10-14'); assert.equal(ui.field('time').value, '08:20');
    ui.submit(); await settle(); assert.equal(ui.requests[0].payload.timeZone, 'Asia/Tokyo');
});
test('4D.1D: payload exacto, versión capturada, doble submit y busy', async () => {
    const data = agendaFixture(), ui = await setup({ data }), pending = deferred();
    ui.open(); data[0].version = 99; ui.outcomes.push(pending.promise);
    ui.submit(); ui.submit(); ui.r('confirm').click();
    assert.equal(ui.requests.length, 1); assert.equal(ui.keys, 1);
    const request = ui.requests[0];
    assert.deepEqual(Object.keys(request).sort(), ['access', 'idempotencyKey', 'meetingId', 'payload', 'signal']);
    assert.equal(request.meetingId, data[0].id); assert.equal(request.access, ui.access); assert.ok(request.signal instanceof AbortSignal);
    assert.deepEqual({ ...request.payload }, { date: '2026-10-13', time: '09:30', timeZone: 'America/Guayaquil', durationMinutes: 45, mode: 'online', expectedVersion: 1 });
    assert.ok(Object.isFrozen(request.payload));
    assert.equal(ui.r('fields').disabled, true); assert.equal(ui.r('cancel').disabled, true);
    assert.equal(ui.r('dialog').getAttribute('aria-busy'), 'true'); assert.equal(ui.r('form').getAttribute('aria-busy'), 'true');
    ui.escape(); assert.equal(ui.r('dialog').open, true);
    pending.resolve(); await settle();
    assert.equal(ui.r('dialog').open, false); assert.equal(ui.gets.length, 2);
    assert.equal(ui.document.activeElement, ui.q('[data-agenda-day]'));
});
for (const [name, value] of [['date', ''], ['time', ''], ['durationMinutes', '0'], ['durationMinutes', '1.5'], ['mode', '']]) {
    test(`4D.1D: valida ${name}=${value} sin key ni request`, async () => {
        const ui = await setup(); ui.open(); ui.field(name).value = value; ui.submit();
        assert.equal(ui.keys, 0); assert.equal(ui.requests.length, 0); assert.ok(ui.r('message').textContent);
    });
}
test('4D.1D: éxito moviendo a B recarga A y elimina la reunión por GET', async () => {
    const ui = await setup(); const day = ui.q('[data-agenda-date]').value;
    ui.open(); ui.field('date').value = '2028-01-01'; ui.loads.push([]); ui.submit(); await settle();
    assert.equal(ui.r('dialog').open, false); assert.equal(ui.q('[data-agenda-date]').value, day);
    assert.equal(ui.gets[1].from, ui.gets[0].from); assert.equal(ui.gets[1].to, ui.gets[0].to);
    assert.equal(ui.q('[data-agenda-rows]').children.length, 0); assert.match(ui.r('announcement').textContent, /reprogramada/);
    assert.equal(ui.field('date').value, ''); assert.equal(ui.r('client').textContent, '');
});
for (const code of ['network', 'timeout', 'server', 'invalid_response', 'unavailable']) test(`4D.1D: ${code} mantiene intento idéntico y bloquea edición/Escape`, async () => {
    const ui = await setup(); ui.open(); ui.outcomes.push(error(code), error(code));
    ui.submit(); await settle(); const first = ui.requests[0];
    assert.equal(ui.r('fields').disabled, true); assert.equal(ui.r('confirm').disabled, false);
    assert.equal(ui.r('cancel').disabled, true); assert.equal(ui.r('discard').hidden, false);
    ui.escape(); assert.equal(ui.r('dialog').open, true);
    // Incluso una modificación programática del input no cambia el comando congelado.
    ui.field('time').value = '23:50'; ui.submit(); await settle();
    assert.equal(ui.keys, 1); assert.equal(ui.requests.length, 2);
    for (const key of ['meetingId', 'idempotencyKey', 'payload', 'access', 'signal']) assert.equal(ui.requests[1][key], first[key]);
    assert.doesNotMatch(ui.r('message').textContent, /SECRET/);
});
test('4D.1D: descartar incierto obliga GET y permite nueva key/versión solo después', async () => {
    const ui = await setup(), refresh = deferred(); ui.open(); ui.outcomes.push(error('network'));
    ui.submit(); await settle(); const old = ui.q('[data-agenda-reschedule]');
    ui.loads.push(refresh.promise); ui.r('discard').click();
    assert.equal(ui.r('dialog').open, false); old.click(); ui.submit(); assert.equal(ui.requests.length, 1);
    const updated = agendaFixture(); updated[0].version = 2;
    refresh.resolve(updated); await settle(); ui.open(); ui.field('time').value = '12:00'; ui.submit(); await settle();
    assert.equal(ui.keys, 2); assert.equal(ui.requests[1].payload.expectedVersion, 2); assert.equal(ui.requests[1].payload.time, '12:00');
});
for (const [status, domainCode] of [[400, undefined], [422, undefined], [422, 'MEETING_NOT_IN_FUTURE'], [422, 'INVALID_TIME_ZONE'], [422, 'INVALID_LOCAL_TIME']]) {
    test(`4D.1D: corrección ${status}/${domainCode} crea nueva key con mensaje seguro`, async () => {
        const ui = await setup(); ui.open(); ui.outcomes.push(error('operation', status, domainCode)); ui.submit(); await settle();
        assert.equal(ui.r('fields').disabled, false); assert.equal(ui.r('dialog').open, true);
        assert.doesNotMatch(ui.r('message').textContent, /SECRET|MEETING_|INVALID_/);
        ui.field('time').value = '13:45'; ui.submit(); await settle();
        assert.equal(ui.keys, 2); assert.notEqual(ui.requests[0].idempotencyKey, ui.requests[1].idempotencyKey);
        assert.equal(ui.requests[1].payload.time, '13:45');
    });
}
for (const [status, domainCode] of [[409, 'MEETING_VERSION_CONFLICT'], [409, 'IDEMPOTENCY_KEY_REUSED'], [404, 'MEETING_NOT_FOUND'], [409, 'MEETING_NOT_SCHEDULED']]) {
    test(`4D.1D: ${domainCode} fuerza GET; fallo impide reusar acción vieja`, async () => {
        const ui = await setup(); const old = ui.q('[data-agenda-reschedule]'); ui.open();
        ui.outcomes.push(error('operation', status, domainCode)); ui.loads.push(error('network'));
        ui.submit(); await settle();
        assert.equal(ui.r('dialog').open, false); assert.equal(ui.gets.length, 2); assert.equal(ui.requests.length, 1);
        assert.equal(ui.q('[data-agenda-retry]').hidden, false); assert.equal(ui.q('[data-agenda-rows]').children.length, 0);
        assert.doesNotMatch(ui.r('announcement').textContent, /SECRET|MEETING_|IDEMPOTENCY_/);
        old.disabled = false; old.click(); ui.submit(); assert.equal(ui.requests.length, 1);
        const updated = agendaFixture(); updated[0].version = 4; ui.loads.push(updated);
        ui.q('[data-agenda-retry]').click(); await settle(); old.click(); assert.equal(ui.r('dialog').open, false);
        ui.open(); ui.submit(); await settle(); assert.equal(ui.requests[1].payload.expectedVersion, 4); assert.equal(ui.keys, 2);
    });
}
test('4D.1D: 403 bloquea autorización actual incluso tras GET; reautorizar libera', async () => {
    const ui = await setup(); ui.open(); ui.outcomes.push(error('forbidden', 403)); ui.submit(); await settle();
    assert.equal(ui.blocks, 0); assert.equal(ui.revalidations, 0); assert.equal(ui.r('confirm').disabled, true);
    ui.r('cancel').click(); assert.equal(ui.q('[data-agenda-reschedule]').disabled, true);
    ui.q('[data-agenda-next]').click(); await settle();
    const button = ui.q('[data-agenda-reschedule]'); assert.equal(button.disabled, true); button.disabled = false; button.click(); ui.submit();
    assert.equal(ui.requests.length, 1); ui.invalidate(); ui.authorize(); await settle(); ui.open(); assert.equal(ui.r('dialog').open, true);
});
for (const code of ['expired', 'stale']) test(`4D.1D: ${code} delega al guard y limpia`, async () => {
    const ui = await setup(); ui.open(); ui.outcomes.push(error(code)); ui.submit(); await settle();
    assert.equal(ui.blocks, code === 'expired' ? 1 : 0); assert.equal(ui.revalidations, code === 'stale' ? 1 : 0);
    assert.equal(ui.r('dialog').open, false); assert.equal(ui.r('client').textContent, ''); assert.equal(ui.field('date').value, '');
    assert.equal(ui.requests[0].signal.aborted, true); ui.submit(); assert.equal(ui.requests.length, 1);
});
for (const lateError of [false, true]) test(`4D.1D: cuenta A tardía (${lateError}) no modifica modal B ni recarga`, async () => {
    const ui = await setup(), pending = deferred(); ui.open(); ui.outcomes.push(pending.promise); ui.submit();
    ui.invalidate(); assert.equal(ui.requests[0].signal.aborted, true);
    const b = { ...ui.access, user: { id: 'B', role: 'agendadora' }, isCurrent: () => true };
    ui.authorize(b); await settle(); ui.open(); const html = ui.q('[data-agenda]').innerHTML, gets = ui.gets.length;
    if (lateError) pending.reject(error('operation', 409, 'MEETING_VERSION_CONFLICT')); else pending.resolve();
    await settle(); assert.equal(ui.q('[data-agenda]').innerHTML, html); assert.equal(ui.gets.length, gets);
    ui.submit(); await settle(); assert.equal(ui.requests[1].access, b); assert.notEqual(ui.requests[1].idempotencyKey, ui.requests[0].idempotencyKey);
});
test('4D.1D: cambiar día aborta/cierra y respuesta tardía no altera B', async () => {
    const ui = await setup(), pending = deferred(); ui.open(); ui.outcomes.push(pending.promise); ui.submit();
    ui.q('[data-agenda-next]').click(); await settle(); assert.equal(ui.requests[0].signal.aborted, true);
    assert.equal(ui.r('dialog').open, false); assert.equal(ui.r('client').textContent, '');
    const html = ui.q('[data-agenda]').innerHTML; pending.resolve(); await settle();
    assert.equal(ui.q('[data-agenda]').innerHTML, html); assert.equal(ui.gets.length, 2);
});
test('4D.1D: refresh tardío A no pisa día B', async () => {
    const ui = await setup(), pending = deferred(); ui.open(); ui.loads.push(pending.promise); ui.submit(); await settle();
    assert.equal(ui.gets.length, 2); ui.q('[data-agenda-next]').click(); await settle();
    assert.equal(ui.gets[1].signal.aborted, true); const html = ui.q('[data-agenda]').innerHTML;
    pending.resolve([]); await settle(); assert.equal(ui.q('[data-agenda]').innerHTML, html);
});
test('4D.1D: XSS se representa como texto y no expone IDs/version/key', async () => {
    const data = agendaFixture(), evil = '<img src=x onerror=alert(1)><script>evil()</script>';
    data[0].consultation.fullName = data[0].consultation.program.name = data[0].assignedTo.fullName = evil;
    const ui = await setup({ data }); ui.open();
    for (const name of ['client', 'program', 'seller']) assert.equal(ui.r(name).textContent, evil);
    assert.equal(ui.r('dialog').querySelectorAll('img,script').length, 0);
    assert.doesNotMatch(ui.r('dialog').textContent, /aaaaaaaa|bbbbbbbb|expectedVersion|fixture-key/);
});
test('4D.1D: labels, título, estados anunciables, Escape/cancel y retorno de foco', async () => {
    const ui = await setup(); const opener = ui.q('[data-agenda-reschedule]'); opener.focus(); ui.open();
    assert.equal(ui.document.getElementById(ui.r('dialog').getAttribute('aria-labelledby')).textContent, 'Reprogramar reunión');
    for (const name of ['date', 'time', 'durationMinutes', 'mode']) assert.ok(ui.field(name).labels.length);
    assert.equal(ui.r('message').getAttribute('aria-live'), 'polite'); assert.equal(ui.r('announcement').getAttribute('role'), 'status');
    ui.escape(); assert.equal(ui.r('dialog').open, false); assert.equal(ui.document.activeElement, opener);
    ui.open(); ui.r('cancel').click(); assert.equal(ui.document.activeElement, opener); assert.equal(ui.keys, 0);
    const ids = [...ui.document.querySelectorAll('[id]')].map(node => node.id); assert.equal(new Set(ids).size, ids.length);
});

// 4D.2E: UI de cancelación con API simulada; no prueba idempotencia PostgreSQL.
const chooseReason = (ui, value = 'client_request') => { ui.c('form').elements.namedItem('reason').value = value; };
for (const role of ['admin', 'agendadora', 'vendedora']) test(`4D.2E visibilidad ${role} y estados terminales`, async () => {
    const ui = await setup({ role });
    assert.equal(ui.document.querySelectorAll('[data-agenda-cancel]').length, role === 'vendedora' ? 0 : 1);
    for (const row of [...ui.q('[data-agenda-rows]').children].slice(1)) assert.equal(row.querySelector('[data-agenda-cancel]'), null);
    ui.cancelOpen(); assert.equal(ui.c('dialog').open, role !== 'vendedora');
    assert.equal(ui.keys, 0);
    if (role === 'vendedora') { chooseReason(ui); ui.cancelSubmit(); assert.equal(ui.cancellations.length, 0); }
});
test('4D.2E contexto, labels, cinco reasons, foco y cierre limpio', async () => {
    const data = agendaFixture(), ui = await setup({ data }); const opener = ui.q('[data-agenda-cancel]');
    opener.focus(); ui.cancelOpen(); const select = ui.c('form').elements.namedItem('reason');
    assert.equal(select.value, ''); assert.equal(ui.document.activeElement, select); assert.equal(ui.keys, 0);
    assert.equal(ui.c('client').textContent, data[0].consultation.fullName);
    assert.equal(ui.c('program').textContent, data[0].consultation.program.name);
    assert.equal(ui.c('seller').textContent, data[0].assignedTo.fullName);
    assert.equal(ui.c('status').textContent, 'Programada'); assert.match(ui.c('schedule').textContent, /2026/);
    assert.deepEqual([...select.options].map(o => [o.value, o.textContent]), [['', 'Selecciona un motivo'],
        ['client_request', 'Solicitud del cliente'], ['staff_unavailable', 'Asesor no disponible'], ['duplicate', 'Reunión duplicada'],
        ['administrative', 'Motivo administrativo'], ['other', 'Otro motivo']]);
    assert.equal(ui.document.getElementById(ui.c('dialog').getAttribute('aria-labelledby')).textContent, 'Cancelar reunión');
    assert.equal(select.labels[0].textContent, 'Motivo de cancelación');
    assert.equal(ui.document.getElementById(select.getAttribute('aria-describedby')), ui.c('message'));
    assert.equal(ui.c('message').getAttribute('role'), 'status'); assert.equal(ui.c('message').getAttribute('aria-live'), 'polite');
    chooseReason(ui, 'other'); assert.equal(ui.keys, 0); ui.cancelEscape();
    assert.equal(ui.c('dialog').open, false); assert.equal(select.value, ''); assert.equal(ui.document.activeElement, opener);
    ui.cancelOpen(); assert.equal(select.value, ''); ui.c('back').click(); assert.equal(ui.c('client').textContent, '');
    const ids = [...ui.document.querySelectorAll('[id]')].map(n => n.id); assert.equal(new Set(ids).size, ids.length);
});
for (const value of ['', 'CLIENT_REQUEST', ' client_request', 'customer_request']) test(`4D.2E reason inválido ${value}`, async () => {
    const ui = await setup(); ui.cancelOpen();
    const option = ui.document.createElement('option'); option.value = value; option.textContent = value;
    ui.c('form').elements.namedItem('reason').append(option); chooseReason(ui, value); ui.cancelSubmit();
    assert.equal(ui.cancellations.length, 0); assert.equal(ui.keys, 0); assert.match(ui.c('message').textContent, /Selecciona/);
});
for (const reason of ['client_request', 'staff_unavailable', 'duplicate', 'administrative', 'other']) test(`4D.2E submit exacto ${reason}, doble click y snapshot`, async () => {
    const data = agendaFixture(), ui = await setup({ data }), pending = deferred(); ui.cancelOpen();
    data[0].version = 77; const before = JSON.stringify(data); chooseReason(ui, reason); ui.cancelOutcomes.push(pending.promise);
    ui.cancelSubmit(); ui.cancelSubmit(); ui.c('confirm').click();
    assert.equal(ui.cancellations.length, 1); assert.equal(ui.keys, 1);
    const r = ui.cancellations[0]; assert.equal(r.meetingId, data[0].id); assert.equal(r.access, ui.access);
    assert.ok(r.signal instanceof AbortSignal); assert.deepEqual({ ...r.payload }, { expectedVersion: 1, reason });
    assert.deepEqual(Object.keys(r).sort(), ['access', 'idempotencyKey', 'meetingId', 'payload', 'signal']); assert.ok(Object.isFrozen(r.payload));
    assert.equal(ui.c('fields').disabled, true); assert.equal(ui.c('form').elements.namedItem('reason').matches(':disabled'), true);
    assert.equal(ui.c('confirm').disabled, true); assert.equal(ui.c('back').disabled, true);
    assert.equal(ui.c('confirm').textContent, 'Cancelando…'); assert.equal(ui.c('dialog').getAttribute('aria-busy'), 'true');
    ui.cancelEscape(); ui.c('back').click(); assert.equal(ui.c('dialog').open, true);
    assert.equal(JSON.stringify(data), before); assert.equal(ui.gets.length, 1);
    pending.resolve(); await settle(); assert.equal(ui.c('dialog').open, false); assert.equal(ui.gets.length, 2);
});
test('4D.2E éxito año10000 ignora PATCH, GET cancelled y mismo día', async () => {
    const ui = await setup(); const day = ui.q('[data-agenda-date]').value;
    const updated = agendaFixture(); updated[0].status = 'cancelled'; updated[0].version = 2;
    let reads = 0;
    const result = { status: 'cancelled', version: 2, get scheduledAt() { reads++; throw Error('PATCH must not be formatted'); } };
    ui.cancelOpen(); chooseReason(ui); ui.cancelOutcomes.push(result); ui.loads.push(updated); ui.cancelSubmit(); await settle();
    assert.equal(reads, 0); assert.equal(ui.c('dialog').open, false); assert.equal(ui.gets.length, 2);
    assert.equal(ui.gets[1].from, ui.gets[0].from); assert.equal(ui.gets[1].to, ui.gets[0].to);
    assert.equal(ui.q('[data-agenda-date]').value, day); assert.equal(ui.q('[data-agenda-cancel]'), null);
    assert.equal(ui.q('[data-agenda-reschedule]'), null); assert.equal(ui.q('[data-agenda-rows]').children.length, 4);
    assert.match(ui.q('[data-agenda-rows]').firstElementChild.textContent, /Cancelada/);
    assert.match(ui.c('announcement').textContent, /Reunión cancelada/); assert.equal(ui.document.activeElement, ui.q('[data-agenda-day]'));
    // Además del getter centinela, un snapshot literal año 10000 tampoco se renderiza.
    ui.loads.push(agendaFixture()); ui.q('[data-agenda-next]').click(); await settle(); ui.cancelOpen(); chooseReason(ui);
    ui.cancelOutcomes.push({ scheduledAt: '10000-01-01T04:30:00+00:00', status: 'cancelled', version: 2 });
    ui.cancelSubmit(); await settle(); assert.equal(ui.c('dialog').open, false); assert.equal(ui.cancellations.length, 2);
});
test('4D.2E éxito y GET fallido conserva anuncio y retry solo GET', async () => {
    const ui = await setup(), old = ui.q('[data-agenda-cancel]'), oldSchedule = ui.q('[data-agenda-reschedule]');
    ui.cancelOpen(); chooseReason(ui); ui.loads.push(error('network')); ui.cancelSubmit(); await settle();
    assert.match(ui.c('announcement').textContent, /Reunión cancelada/); assert.equal(ui.q('[data-agenda-retry]').hidden, false);
    old.disabled = oldSchedule.disabled = false; old.click(); oldSchedule.click(); ui.cancelSubmit();
    assert.equal(ui.cancellations.length, 1); assert.equal(ui.r('dialog').open, false);
    ui.q('[data-agenda-retry]').click(); await settle(); assert.equal(ui.gets.length, 3); assert.equal(ui.cancellations.length, 1);
});
for (const code of ['network', 'timeout', 'server', 'invalid_response', 'unavailable']) test(`4D.2E uncertain ${code} mantiene intento`, async () => {
    const ui = await setup(); ui.cancelOpen(); chooseReason(ui); ui.cancelOutcomes.push(error(code), error(code));
    ui.cancelSubmit(); await settle(); const first = ui.cancellations[0];
    assert.equal(ui.c('fields').disabled, true); assert.equal(ui.c('confirm').textContent, 'Reintentar cancelación');
    ui.cancelEscape(); ui.c('back').click(); assert.equal(ui.c('dialog').open, true);
    chooseReason(ui, 'other'); ui.cancelSubmit(); await settle();
    assert.equal(ui.keys, 1); assert.equal(ui.cancellations.length, 2);
    for (const k of ['meetingId', 'idempotencyKey', 'payload', 'access', 'signal']) assert.equal(ui.cancellations[1][k], first[k]);
    assert.doesNotMatch(ui.c('message').textContent, /SECRET/);
});
test('4D.2E descarte obliga GET y usa nueva versión/clave en nuevo intento', async () => {
    const ui = await setup(), pending = deferred(), old = ui.q('[data-agenda-cancel]');
    ui.cancelOpen(); chooseReason(ui); ui.cancelOutcomes.push(error('network')); ui.cancelSubmit(); await settle();
    ui.loads.push(pending.promise); ui.c('discard').click(); old.disabled = false; old.click(); ui.open();
    assert.equal(ui.c('dialog').open, false); assert.equal(ui.r('dialog').open, false);
    const updated = agendaFixture(); updated[0].version = 8; pending.resolve(updated); await settle();
    old.click(); assert.equal(ui.c('dialog').open, false); ui.cancelOpen(); chooseReason(ui, 'other'); ui.cancelSubmit(); await settle();
    assert.equal(ui.keys, 2); assert.notEqual(ui.cancellations[0].idempotencyKey, ui.cancellations[1].idempotencyKey);
    assert.deepEqual({ ...ui.cancellations[1].payload }, { expectedVersion: 8, reason: 'other' });
});
for (const [status, domain, message] of [[409, 'MEETING_VERSION_CONFLICT', /cambió/], [409, 'MEETING_NOT_SCHEDULED', /no está programada/],
    [404, 'MEETING_NOT_FOUND', /no está disponible/], [409, 'IDEMPOTENCY_KEY_REUSED', /intento no pudo completarse/],
    [409, 'CONSULTATION_STATE_INCONSISTENT', /revisión administrativa/], [409, undefined, /información/]]) {
    test(`4D.2E conflicto ${domain} bloquea ambas acciones hasta GET`, async () => {
        const ui = await setup(); const old = ui.q('[data-agenda-cancel]'), schedule = ui.q('[data-agenda-reschedule]');
        ui.cancelOpen(); chooseReason(ui); ui.cancelOutcomes.push(error('operation', status, domain)); ui.loads.push(error('network'));
        ui.cancelSubmit(); await settle(); assert.equal(ui.c('dialog').open, false); assert.match(ui.c('announcement').textContent, message);
        assert.equal(ui.keys, 1); assert.equal(ui.cancellations.length, 1); assert.equal(ui.gets.length, 2);
        old.disabled = schedule.disabled = false; old.click(); schedule.click(); ui.cancelSubmit();
        assert.equal(ui.c('dialog').open, false); assert.equal(ui.r('dialog').open, false);
        ui.loads.push([]); ui.q('[data-agenda-retry]').click(); await settle();
        assert.equal(ui.q('[data-agenda-cancel]'), null); assert.equal(ui.keys, 1);
    });
}
for (const failure of [error('invalid_input'), error('operation', 400)]) test('4D.2E corregir 400 crea intento distinto', async () => {
    const ui = await setup(); ui.cancelOpen(); chooseReason(ui); ui.cancelOutcomes.push(failure); ui.cancelSubmit(); await settle();
    assert.equal(ui.c('fields').disabled, false); assert.doesNotMatch(ui.c('message').textContent, /SECRET/);
    chooseReason(ui, 'other'); ui.cancelSubmit(); await settle(); assert.equal(ui.keys, 2);
    assert.notEqual(ui.cancellations[0].idempotencyKey, ui.cancellations[1].idempotencyKey);
});
test('4D.2E forbidden solo bloquea cancelación hasta nueva autorización', async () => {
    const ui = await setup(); ui.cancelOpen(); chooseReason(ui); ui.cancelOutcomes.push(error('forbidden', 403)); ui.cancelSubmit(); await settle();
    assert.equal(ui.c('confirm').disabled, true); assert.equal(ui.c('back').disabled, false); assert.equal(ui.blocks, 0);
    ui.open(); assert.equal(ui.r('dialog').open, false); ui.c('back').click(); ui.open(); assert.equal(ui.r('dialog').open, true);
    ui.r('cancel').click(); ui.q('[data-agenda-next]').click(); await settle();
    assert.equal(ui.q('[data-agenda-cancel]').disabled, true); ui.q('[data-agenda-cancel]').disabled = false; ui.cancelOpen();
    assert.equal(ui.c('dialog').open, false); ui.invalidate(); ui.authorize(); await settle(); ui.cancelOpen(); assert.equal(ui.c('dialog').open, true);
});
for (const code of ['expired', 'stale']) test(`4D.2E ${code} delega en shell`, async () => {
    const ui = await setup(); ui.cancelOpen(); chooseReason(ui); ui.cancelOutcomes.push(error(code)); ui.cancelSubmit(); await settle();
    assert.equal(ui.blocks, code === 'expired' ? 1 : 0); assert.equal(ui.revalidations, code === 'stale' ? 1 : 0);
    assert.equal(ui.c('dialog').open, false); assert.equal(ui.c('form').elements.namedItem('reason').value, ''); assert.equal(ui.cancellations[0].signal.aborted, true);
});
for (const first of ['cancel', 'reschedule']) test(`4D.2E exclusión cruzada ${first} editable/sending/uncertain`, async () => {
    const ui = await setup(), pending = deferred();
    if (first === 'cancel') { ui.cancelOpen(); chooseReason(ui); ui.cancelOutcomes.push(pending.promise); }
    else { ui.open(); ui.outcomes.push(pending.promise); }
    const cross = () => { if (first === 'cancel') ui.open(); else ui.cancelOpen(); };
    cross(); assert.equal(first === 'cancel' ? ui.r('dialog').open : ui.c('dialog').open, false);
    if (first === 'cancel') ui.cancelSubmit(); else ui.submit(); cross();
    assert.equal(first === 'cancel' ? ui.r('dialog').open : ui.c('dialog').open, false);
    pending.reject(error('network')); await settle(); cross();
    assert.equal(first === 'cancel' ? ui.r('dialog').open : ui.c('dialog').open, false);
    (first === 'cancel' ? ui.c('discard') : ui.r('discard')).click(); await settle(); cross();
    assert.equal(first === 'cancel' ? ui.r('dialog').open : ui.c('dialog').open, true);
});
for (const lateError of [false, true]) test(`4D.2E sesión nueva ignora respuesta vieja ${lateError}`, async () => {
    const ui = await setup(), pending = deferred(); ui.cancelOpen(); chooseReason(ui); ui.cancelOutcomes.push(pending.promise); ui.cancelSubmit();
    ui.invalidate(); assert.equal(ui.cancellations[0].signal.aborted, true);
    ui.authorize({ ...ui.access, user: { role: 'agendadora' }, isCurrent: () => true }); await settle(); ui.cancelOpen();
    const before = ui.q('[data-agenda]').innerHTML, count = ui.gets.length;
    if (lateError) pending.reject(error('operation', 409)); else pending.resolve(); await settle();
    assert.equal(ui.q('[data-agenda]').innerHTML, before); assert.equal(ui.gets.length, count);
});
test('4D.2E cambio de fecha aborta y respuesta vieja no afecta diálogo nuevo', async () => {
    const ui = await setup(), pending = deferred(); ui.cancelOpen(); chooseReason(ui); ui.cancelOutcomes.push(pending.promise); ui.cancelSubmit();
    ui.q('[data-agenda-next]').click(); await settle(); assert.equal(ui.cancellations[0].signal.aborted, true);
    ui.cancelOpen(); const before = ui.q('[data-agenda]').innerHTML; pending.resolve(); await settle();
    assert.equal(ui.q('[data-agenda]').innerHTML, before); assert.equal(ui.gets.length, 2);
});
test('4D.2E GET tardío tras cancelación no pisa nuevo día', async () => {
    const ui = await setup(), pending = deferred(); ui.cancelOpen(); chooseReason(ui); ui.loads.push(pending.promise); ui.cancelSubmit(); await settle();
    ui.q('[data-agenda-next]').click(); await settle(); const before = ui.q('[data-agenda]').innerHTML;
    assert.equal(ui.gets[1].signal.aborted, true); pending.resolve([]); await settle(); assert.equal(ui.q('[data-agenda]').innerHTML, before);
});
test('4D.2E contexto XSS usa texto y no expone identificadores', async () => {
    const data = agendaFixture(), evil = '<img src=x onerror=alert(1)>';
    data[0].consultation.fullName = data[0].consultation.program.name = data[0].assignedTo.fullName = evil;
    const ui = await setup({ data }); ui.cancelOpen();
    for (const name of ['client', 'program', 'seller']) assert.equal(ui.c(name).textContent, evil);
    assert.equal(ui.c('dialog').querySelector('img'), null); assert.doesNotMatch(ui.c('dialog').textContent, /aaaaaaaa|bbbbbbbb|fixture-key/);
});
