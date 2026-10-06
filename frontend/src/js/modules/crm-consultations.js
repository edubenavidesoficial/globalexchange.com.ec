import { getInternal } from '../api/internal.js';

const statuses = { pending: 'Pendiente', converted: 'Convertida', cancelled: 'Cancelada' };
const modes = { online: 'En línea', phone: 'Teléfono', office: 'Oficina' };
const text = value => typeof value === 'string' && value.trim() ? value : '—';
const label = (map, value) => Object.hasOwn(map, value) ? map[value] : '—';

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
    const find = name => root.querySelector(`[data-consultations-${name}]`);
    const rows = find('rows');
    const refresh = find('refresh');
    const retry = find('retry');
    let access = null;
    let generation = 0;
    let pending = null;

    function clear() {
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
        generation += 1;
        pending?.abort();
        pending = null;
        access = null;
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
            fragment.append(row);
        }
        rows.replaceChildren(fragment);
        for (const element of root.querySelectorAll('[data-count]')) {
            element.textContent = String(element.dataset.count === 'total' ? data.length
                : data.filter(item => item.status === element.dataset.count).length);
        }
        find('summary').hidden = false;
        find('results').hidden = data.length === 0;
        find('status').textContent = data.length ? `${data.length} solicitudes cargadas.` : 'No hay solicitudes registradas todavía.';
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
            render(body.data);
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
    return {
        onInvalidate: invalidate,
        onAuthorized(value) { access = value; void load(); },
    };
}
