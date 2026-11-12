import { getInternal } from '../api/internal.js';
import { initMeetingDialog } from './crm-meeting-dialog.js';

const statuses = { pending: 'Pendiente', converted: 'Convertida', cancelled: 'Cancelada' };
const modes = { online: 'En línea', phone: 'Teléfono', office: 'Oficina' };
const text = value => typeof value === 'string' && value.trim() ? value : '—';
const label = (map, value) => Object.hasOwn(map, value) ? map[value] : '—';
const instances = new WeakMap();
const normalize = value => typeof value === 'string' ? value.trim().toLocaleLowerCase('es') : '';
const programId = item => typeof item.program?.id === 'string' ? item.program.id.trim() : '';

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
    let loadedData = null;
    let access = null;
    let generation = 0;
    let pending = null;
    let schedulingDenied = false;
    let refreshRequired = false;
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
        meeting.invalidate();
        schedulingDenied = false;
        refreshRequired = false;
        generation += 1;
        pending?.abort();
        pending = null;
        access = null;
        filters.search = filters.state = filters.program = '';
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
            if (item.status === 'pending' && ['admin', 'agendadora'].includes(access?.user?.role)) {
                const button = node('button', 'Agendar reunión', 'crm-button consultations-meeting-open');
                button.type = 'button'; button.dataset.meetingOpen = '';
                button.disabled = schedulingDenied || refreshRequired;
                button.addEventListener('click', () => { if (!schedulingDenied && !refreshRequired) meeting.open(item, access, button); });
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
        const visible = loadedData.filter(item =>
            (!query || [item.fullName, item.phone, item.email].some(value => normalize(value).includes(query))) &&
            (!filters.state || item.status === filters.state) &&
            (!filters.program || programId(item) === filters.program));
        render(visible);
        find('filter-count').hidden = false;
        find('filter-count').textContent = `Mostrando ${visible.length} de ${loadedData.length} solicitudes cargadas`;
        find('status').textContent = refreshRequired
            ? 'La bandeja debe actualizarse antes de agendar otra reunión.'
            : !loadedData.length ? 'No hay solicitudes cargadas.'
                : !visible.length ? 'Ninguna solicitud cargada coincide con los filtros. Puedes limpiar los filtros.' : '';
    }
    function acceptData(data) {
        loadedData = data;
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
        if (removedProgram) find('status').textContent = 'El programa seleccionado ya no está entre las solicitudes cargadas. Se muestran todos los programas. ' + find('status').textContent;
    }
    async function load() {
        if (pending || !access?.isCurrent()) return;
        const current = access;
        const version = generation;
        const controller = new AbortController();
        pending = controller;
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
