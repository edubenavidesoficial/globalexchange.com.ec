import { getInternal } from '../api/internal.js';
import { initMeetingDialog } from './crm-meeting-dialog.js';

const statuses = { pending: 'Pendiente', converted: 'Convertida', cancelled: 'Cancelada' };
const modes = { online: 'En línea', phone: 'Teléfono', office: 'Oficina' };
const text = value => typeof value === 'string' && value.trim() ? value : '—';
const label = (map, value) => Object.hasOwn(map, value) ? map[value] : '—';
const instances = new WeakMap();
const normalize = value => typeof value === 'string' ? value.trim().toLocaleLowerCase('es') : '';
const programId = item => typeof item.program?.id === 'string' ? item.program.id.trim() : '';
const requestId = value => typeof value === 'string' && value.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
const orders = { recent: 'Más recientes primero', oldest: 'Más antiguas primero', 'name-asc': 'Nombre A–Z', 'name-desc': 'Nombre Z–A' };
const names = new Intl.Collator('es', { sensitivity: 'base' });

function creationInstant(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match || match[0] !== value) return null;
    const [, year, month, day, hour, minute, second, fraction = '', zone] = match;
    const leap = +year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (+month < 1 || +month > 12 || +day < 1 || +day > days[+month - 1] ||
        +hour > 23 || +minute > 59 || +second > 59 ||
        (zone !== 'Z' && (+zone.slice(1, 3) > 23 || +zone.slice(4) > 59))) return null;
    const seconds = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`) / 1000;
    // Segundos UTC enteros + fracción decimal exacta, sin límite de microsegundos.
    // Sin ceros finales, comparar las fracciones como texto conserva su valor.
    return Number.isFinite(seconds) ? { seconds, fraction: fraction.replace(/0+$/, '') } : null;
}

function orderedRequests(data, order) {
    const entries = data.map((item, index) => ({
        item, index, time: creationInstant(item.createdAt), name: normalize(item.fullName), id: requestId(item.id),
    }));
    const byDate = (a, b, direction) => {
        if (a.time === null || b.time === null) return Number(a.time === null) - Number(b.time === null);
        return direction * (a.time.seconds - b.time.seconds ||
            (a.time.fraction < b.time.fraction ? -1 : a.time.fraction > b.time.fraction ? 1 : 0));
    };
    const primary = (a, b) => {
        if (order === 'recent' || order === 'oldest') return byDate(a, b, order === 'oldest' ? 1 : -1);
        const missing = Number(!a.name) - Number(!b.name);
        return missing || (order === 'name-desc' ? -1 : 1) * names.compare(a.name, b.name) || byDate(a, b, -1);
    };
    entries.sort((a, b) => primary(a, b) || a.index - b.index);
    // Un ID anómalo no tiene posición lexicográfica fiable. Mantener su grupo
    // empatado evita comparadores no transitivos al mezclar IDs e índices.
    for (let start = 0; start < entries.length;) {
        let end = start + 1;
        while (end < entries.length && primary(entries[start], entries[end]) === 0) end++;
        const group = entries.slice(start, end);
        if (group.every(entry => entry.id)) {
            group.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : a.index - b.index));
            for (let offset = 0; offset < group.length; offset++) entries[start + offset] = group[offset];
        }
        start = end;
    }
    return entries.map(entry => entry.item);
}

export function calendarDate(value) {
    // Fecha calendario: nunca pasa por Date ni por una conversión de zona horaria.
    const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}
function createdDate(value) {
    if (typeof value !== 'string' || !value.trim()) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-EC', {
        timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(date);
}
function node(tag, value, className) {
    const element = document.createElement(tag);
    if (value !== undefined) element.textContent = text(value);
    if (className) element.className = className;
    return element;
}

export function initCRMConsultations() {
    const root = document.querySelector('[data-consultations]');
    if (!root) return;
    if (instances.has(root)) return instances.get(root);
    const find = name => root.querySelector(`[data-consultations-${name}]`);
    const rows = find('rows');
    const refresh = find('refresh');
    const retry = find('retry');
    const search = find('search'), state = find('state'), program = find('program');
    const filters = { search: '', state: '', program: '' };
    const order = find('order');
    let selectedOrder = 'recent';
    order.value = selectedOrder;
    let loadedData = null;
    let access = null;
    let generation = 0;
    let pending = null;
    let schedulingDenied = false;
    let refreshRequired = false;
    const detailDialog = find('detail');
    const detailContent = find('detail-content');
    const detailStatus = find('detail-status');
    let selectedId = null;
    let detailOpener = null;
    function closeDetail(restoreFocus = true) {
        const opener = detailOpener;
        const hadSelection = selectedId !== null;
        selectedId = null;
        detailOpener = null;
        detailContent.replaceChildren();
        detailStatus.textContent = '';
        detailDialog.setAttribute('aria-busy', 'false');
        if (detailDialog.open) detailDialog.close();
        if (restoreFocus && hadSelection && access?.isCurrent()) {
            if (opener?.isConnected && !opener.disabled) opener.focus();
            else focusHeading();
        }
    }
    function selectedRequest(id) {
        if (!id || !loadedData) return null;
        const matches = loadedData.filter(item => requestId(item.id) === id);
        return matches.length === 1 ? matches[0] : null;
    }
    function renderDetail(item) {
        detailContent.replaceChildren();
        const time = typeof item.preferredTime === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(item.preferredTime) ? item.preferredTime.slice(0, 5) : '—';
        const groups = [
            ['Identificación de la solicitud', [['Identificador de solicitud', item.id], ['Estado actual', label(statuses, item.status)], ['Fecha de creación', createdDate(item.createdAt)]]],
            ['Contacto', [['Nombre del interesado', item.fullName], ['Teléfono', item.phone], ['Correo electrónico', item.email], ['Ciudad', item.city]]],
            ['Programa', [['Programa de interés', item.program?.name]]],
            ['Solicitud de asesoría', [['Modalidad preferida', label(modes, item.mode)], ['Fecha preferida para asesoría', calendarDate(item.preferredDate)], ['Hora preferida para asesoría', time], ['Mensaje del interesado', item.message]]],
        ];
        for (const [title, fields] of groups) {
            const section = node('section');
            section.append(node('h3', title));
            const list = node('dl');
            for (const [name, value] of fields) {
                const pair = node('div');
                pair.append(node('dt', name), node('dd', text(value) === '—' ? 'No disponible' : value));
                list.append(pair);
            }
            section.append(list);
            detailContent.append(section);
        }
        detailDialog.setAttribute('aria-busy', 'false');
        detailStatus.textContent = '';
    }
    function openDetail(id, opener, owner, version) {
        if (access !== owner || version !== generation || !access?.isCurrent() || pending ||
            !opener.isConnected || root.querySelector('dialog[open]')) return;
        const item = selectedRequest(id);
        if (!item) return;
        selectedId = id;
        detailOpener = opener;
        renderDetail(item);
        detailDialog.showModal();
        root.querySelector('#consultation-detail-title').focus();
    }
    find('detail-close').addEventListener('click', () => closeDetail());
    detailDialog.addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
    detailDialog.addEventListener('close', () => {
        if (!detailDialog.open && selectedId) closeDetail();
    });
    const focusHeading = () => {
        const heading = root.querySelector('#consultations-title');
        if (access?.isCurrent() && heading?.isConnected) heading.focus();
    };
    const meeting = initMeetingDialog(root, { async reload() {
        const current = access;
        focusHeading();
        await load();
        if (access === current) focusHeading();
    }, requireRefresh() {
        refreshRequired = true;
        rows.querySelectorAll('[data-meeting-open]').forEach(button => { button.disabled = true; });
        find('status').textContent = 'La bandeja debe actualizarse antes de agendar otra reunión.';
    }, forbid() {
        schedulingDenied = true;
        rows.querySelectorAll('[data-meeting-open]').forEach(button => { button.disabled = true; });
    } });

    function clear() {
        loadedData = null;
        program.replaceChildren(Object.assign(document.createElement('option'), { value: '', textContent: 'Todos los programas' }));
        find('filters').disabled = true;
        find('filter-count').textContent = '';
        find('filter-count').hidden = true;
        rows.replaceChildren();
        find('results').hidden = true;
        find('summary').hidden = true;
        root.querySelectorAll('[data-count]').forEach(element => { element.textContent = '0'; });
        retry.hidden = true;
        find('status').textContent = '';
    }
    function busy(value) {
        refresh.disabled = value || !access;
        refresh.setAttribute('aria-busy', String(value));
        retry.disabled = value;
        root.setAttribute('aria-busy', String(value));
    }
    function invalidate() {
        closeDetail(false);
        meeting.invalidate();
        schedulingDenied = false;
        refreshRequired = false;
        generation += 1;
        pending?.abort();
        pending = null;
        access = null;
        filters.search = filters.state = filters.program = '';
        selectedOrder = order.value = 'recent';
        find('caption').textContent = `Solicitudes registradas · ${orders[selectedOrder]}`;
        search.value = state.value = '';
        clear();
        busy(false);
    }
    function render(data) {
        const fragment = document.createDocumentFragment();
        for (const item of data) {
            const row = node('tr');
            const cell = title => {
                const element = node('td');
                element.dataset.label = title;
                row.append(element);
                return element;
            };
            cell('Solicitante').append(node('strong', item.fullName), node('span', item.city, 'consultations-secondary'));
            cell('Programa').append(node('span', item.program?.name));
            const contact = cell('Contacto');
            contact.append(node('span', item.phone), node('span', item.email, 'consultations-secondary'));
            const detail = node('details');
            detail.append(node('summary', 'Mensaje'), node('p', item.message));
            contact.append(detail);
            const time = typeof item.preferredTime === 'string' && /^\d{2}:\d{2}/.test(item.preferredTime)
                ? item.preferredTime.slice(0, 5) : '—';
            cell('Preferencia').append(node('span', calendarDate(item.preferredDate)), node('span', time, 'consultations-secondary'));
            cell('Modalidad').append(node('span', label(modes, item.mode)));
            const badge = node('span', label(statuses, item.status), 'consultations-badge');
            if (Object.hasOwn(statuses, item.status)) badge.classList.add(`consultations-badge--${item.status}`);
            cell('Estado').append(badge);
            cell('Recibida').append(node('span', createdDate(item.createdAt)));
            const action = cell('Acción');
            const id = requestId(item.id);
            const owner = access, version = generation;
            const view = node('button', 'Ver detalle', 'crm-button consultations-detail-open');
            view.type = 'button';
            view.dataset.consultationsDetailOpen = '';
            view.disabled = !selectedRequest(id);
            view.addEventListener('click', () => openDetail(id, view, owner, version));
            action.append(view);
            if (item.status === 'pending' && ['admin', 'agendadora'].includes(access?.user?.role)) {
                const button = node('button', 'Agendar reunión', 'crm-button consultations-meeting-open');
                button.type = 'button'; button.dataset.meetingOpen = '';
                button.disabled = schedulingDenied || refreshRequired;
                button.addEventListener('click', () => { if (!root.querySelector('dialog[open]') && !schedulingDenied && !refreshRequired) meeting.open(item, access, button); });
                action.append(button);
            }
            fragment.append(row);
        }
        rows.replaceChildren(fragment);
        find('results').hidden = data.length === 0;
    }
    function applyFilters() {
        if (loadedData === null || !access?.isCurrent()) return;
        const query = normalize(filters.search);
        const filtered = loadedData.filter(item =>
            (!query || [item.fullName, item.phone, item.email].some(value => normalize(value).includes(query))) &&
            (!filters.state || item.status === filters.state) &&
            (!filters.program || programId(item) === filters.program));
        const visible = orderedRequests(filtered, selectedOrder);
        render(visible);
        find('caption').textContent = `Solicitudes registradas · ${orders[selectedOrder]}`;
        find('filter-count').hidden = false;
        find('filter-count').textContent = `Mostrando ${visible.length} de ${loadedData.length} solicitudes cargadas`;
        find('status').textContent = refreshRequired
            ? 'La bandeja debe actualizarse antes de agendar otra reunión.'
            : !loadedData.length ? 'No hay solicitudes cargadas.'
                : !visible.length ? 'Ninguna solicitud cargada coincide con los filtros. Puedes limpiar los filtros.' : '';
    }
    function acceptData(data) {
        loadedData = data;
        order.value = selectedOrder;
        const programs = new Map();
        for (const item of data) {
            const id = programId(item);
            if (id && normalize(item.program?.name)) programs.set(id, item.program.name);
        }
        for (const [id, name] of programs) {
            const option = document.createElement('option');
            option.value = id; option.textContent = name;
            program.append(option);
        }
        const removedProgram = filters.program && !programs.has(filters.program);
        if (removedProgram) filters.program = '';
        program.value = filters.program;
        for (const element of root.querySelectorAll('[data-count]')) {
            element.textContent = String(element.dataset.count === 'total' ? data.length
                : data.filter(item => item.status === element.dataset.count).length);
        }
        find('summary').hidden = false;
        find('filters').disabled = false;
        applyFilters();
        if (selectedId) {
            const item = selectedRequest(selectedId);
            if (item) renderDetail(item);
            else {
                closeDetail();
                find('status').textContent = 'La solicitud ya no está disponible entre los datos cargados.';
            }
        }
        if (removedProgram) find('status').textContent = 'El programa seleccionado ya no está entre las solicitudes cargadas. Se muestran todos los programas. ' + find('status').textContent;
    }
    async function load() {
        if (pending || !access?.isCurrent()) return;
        const current = access;
        const version = generation;
        const controller = new AbortController();
        pending = controller;
        if (selectedId) {
            detailOpener = null;
            detailContent.replaceChildren();
            detailDialog.setAttribute('aria-busy', 'true');
            detailStatus.textContent = 'Actualizando solicitud…';
        }
        clear();
        busy(true);
        find('status').textContent = 'Cargando solicitudes…';
        try {
            const body = await getInternal('/api/admin/consultations', current, controller.signal);
            if (version !== generation || !current.isCurrent()) return;
            if (!Array.isArray(body?.data) || body.data.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
                throw new Error('Invalid response');
            }
            refreshRequired = false;
            acceptData(body.data);
        } catch (error) {
            if (version !== generation || !current.isCurrent()) return;
            if (['expired', 'denied'].includes(error?.code)) { current.blockAccess(); return; }
            if (error?.code === 'stale') { current.revalidate(); return; }
            closeDetail();
            clear();
            find('status').textContent = 'No fue posible cargar las solicitudes.';
            retry.hidden = false;
        } finally {
            if (pending === controller) { pending = null; busy(false); }
        }
    }
    refresh.addEventListener('click', () => void load());
    retry.addEventListener('click', () => void load());
    function updateFilters() {
        if (pending || loadedData === null || !access?.isCurrent()) return;
        filters.search = search.value;
        filters.state = state.value;
        filters.program = program.value;
        applyFilters();
    }
    search.addEventListener('input', updateFilters);
    state.addEventListener('change', updateFilters);
    program.addEventListener('change', updateFilters);
    order.addEventListener('change', () => {
        if (pending || loadedData === null || !access?.isCurrent()) return;
        selectedOrder = Object.hasOwn(orders, order.value) ? order.value : 'recent';
        order.value = selectedOrder;
        applyFilters();
        // Reutilizar la región de resultados; el selector conserva el foco.
        find('filter-count').textContent += ` · ${orders[selectedOrder]}`;
    });
    find('clear').addEventListener('click', () => {
        if (pending || loadedData === null || !access?.isCurrent()) return;
        search.value = state.value = program.value = '';
        updateFilters();
    });
    // La página es multipágina: el guard invalida en logout/pagehide y BFCache.
    // Reutilizar hooks evita registrar listeners al inicializar el mismo DOM otra vez.
    const hooks = {
        onInvalidate: invalidate,
        onAuthorized(value) { access = value; void load(); },
    };
    instances.set(root, hooks);
    return hooks;
}
