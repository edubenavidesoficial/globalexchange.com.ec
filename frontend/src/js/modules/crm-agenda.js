import { getAgendaMeetings } from '../api/meetings.js';
import { initCancelDialog } from './crm-cancel-dialog.js';
import { initRescheduleDialog } from './crm-reschedule-dialog.js';
import { agendaToday, shiftAgendaDay, agendaDayRange, agendaDayLabel, agendaHour } from './crm-agenda-date.js';

const modes = { online: 'En línea', phone: 'Teléfono', office: 'Oficina' };
const statuses = { scheduled: 'Programada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió' };
function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
}

export function initCRMAgenda() {
    const root = document.querySelector('[data-agenda]');
    const find = name => root.querySelector(`[data-agenda-${name}]`);
    const rows = find('rows'), date = find('date'), retry = find('retry');
    let day = agendaToday();
    let access = null;
    let pending = null;
    let generation = 0;
    let reschedulingDenied = false;
    let cancellationDenied = false;
    let refreshRequired = false;
    const available = () => Boolean(access?.isCurrent()) && !pending && !refreshRequired;
    const canOpen = () => available() &&
        !root.querySelector('[data-reschedule-dialog]').open && !root.querySelector('[data-cancel-dialog]').open;
    function reload() {
        // Conservar el anuncio del diálogo que acaba de cerrar.
        if (root.querySelector('[data-reschedule-dialog]').open) dialog.invalidate();
        if (root.querySelector('[data-cancel-dialog]').open) cancellation.invalidate();
        refreshRequired = true;
        generation++;
        pending?.abort(); pending = null;
        return load();
    }
    const dialog = initRescheduleDialog(root, {
        canOpen: () => canOpen() && !reschedulingDenied,
        forbid() { reschedulingDenied = true; controls(); },
        reload,
    });

    const cancellation = initCancelDialog(root, {
        canOpen: () => canOpen() && !cancellationDenied,
        forbid() { cancellationDenied = true; controls(); },
        reload,
    });

    function clear() {
        rows.replaceChildren();
        find('summary').textContent = '';
        find('status').textContent = '';
        retry.hidden = true;
    }
    function controls() {
        root.setAttribute('aria-busy', String(Boolean(pending)));
        date.disabled = !access;
        find('previous').disabled = !access || !agendaDayRange(shiftAgendaDay(day, -1));
        find('next').disabled = !access || !agendaDayRange(shiftAgendaDay(day, 1));
        // Sigue disponible si la pestaña permanece abierta al cambiar de día.
        find('today').disabled = !access;
        retry.disabled = !access || Boolean(pending);
        for (const button of rows.querySelectorAll('[data-agenda-reschedule]')) button.disabled = !available() || reschedulingDenied;
        for (const button of rows.querySelectorAll('[data-agenda-cancel]')) button.disabled = !available() || cancellationDenied;
    }
    function showDate() {
        date.value = day;
        find('day').textContent = agendaDayLabel(day);
    }
    function invalidate() {
        dialog.invalidate();
        cancellation.invalidate();
        reschedulingDenied = false; cancellationDenied = false; refreshRequired = false;
        generation++;
        pending?.abort();
        pending = null;
        access = null;
        clear();
        controls();
    }
    function render(data) {
        const fragment = document.createDocumentFragment();
        for (const meeting of data) {
            const item = node('li', undefined, 'agenda-meeting');
            const time = node('div', undefined, 'agenda-time');
            time.append(node('strong', agendaHour(meeting.scheduledAt)), node('span', `${meeting.durationMinutes} min`));
            const person = node('div', undefined, 'agenda-person');
            person.append(node('h3', meeting.consultation.fullName), node('p', meeting.consultation.program.name));
            const details = node('dl', undefined, 'agenda-details');
            const field = (label, value) => {
                const group = node('div');
                group.append(node('dt', label), node('dd', value));
                details.append(group);
            };
            field('Modalidad', modes[meeting.mode]);
            field('Vendedora', meeting.assignedTo.fullName);
            field('Teléfono', meeting.consultation.phone);
            if (meeting.consultation.email !== null) field('Email', meeting.consultation.email);
            const badge = node('span', statuses[meeting.status], `agenda-badge agenda-badge--${meeting.status}`);
            item.append(time, person, badge, details);
            if (['admin', 'agendadora'].includes(access.user.role) && meeting.status === 'scheduled') {
                const button = node('button', 'Reprogramar', 'crm-button agenda-reschedule-open');
                button.type = 'button'; button.dataset.agendaReschedule = '';
                button.setAttribute('aria-label', `Reprogramar reunión de ${meeting.consultation.fullName}`);
                const owner = access, renderedGeneration = generation;
                button.addEventListener('click', () => {
                    if (canOpen() && !reschedulingDenied && owner === access && renderedGeneration === generation) dialog.open(meeting, owner, button);
                });
                const cancel = node('button', 'Cancelar reunión', 'crm-button');
                cancel.type = 'button'; cancel.dataset.agendaCancel = '';
                cancel.setAttribute('aria-label', 'Cancelar reunión de ' + meeting.consultation.fullName);
                cancel.addEventListener('click', () => {
                    if (canOpen() && !cancellationDenied && owner === access && renderedGeneration === generation) cancellation.open(meeting, owner, cancel);
                });
                const actions = node('div', undefined, 'agenda-meeting-actions');
                actions.append(button, cancel); item.append(actions);
            }
            fragment.append(item);
        }
        rows.replaceChildren(fragment);
        find('summary').textContent = `${data.length} ${data.length === 1 ? 'reunión' : 'reuniones'}`;
        find('status').textContent = data.length ? `${data.length} ${data.length === 1 ? 'reunión cargada' : 'reuniones cargadas'}.`
            : 'No hay reuniones programadas para este día.';
    }
    async function load() {
        if (pending || !access?.isCurrent()) return;
        const current = access, version = generation;
        const controller = new AbortController();
        pending = controller;
        clear();
        controls();
        find('status').textContent = 'Cargando reuniones…';
        try {
            const data = await getAgendaMeetings({ ...agendaDayRange(day), access: current, signal: controller.signal });
            if (version !== generation || !current.isCurrent()) return;
            refreshRequired = false;
            render(data);
        } catch (error) {
            if (version !== generation || !current.isCurrent()) return;
            if (['expired', 'denied'].includes(error?.code)) { current.blockAccess(); return; }
            if (error?.code === 'stale') { current.revalidate(); return; }
            clear();
            find('status').textContent = 'No fue posible cargar las reuniones. Intenta de nuevo.';
            retry.hidden = false;
        } finally {
            if (pending === controller) { pending = null; controls(); }
        }
    }
    function select(next) {
        if (!access?.isCurrent()) return;
        if (!agendaDayRange(next)) {
            date.value = day;
            return;
        }
        if (day === next) return;
        dialog.invalidate();
        cancellation.invalidate();
        generation++;
        pending?.abort();
        pending = null;
        day = next;
        showDate();
        void load();
    }
    find('previous').addEventListener('click', () => select(shiftAgendaDay(day, -1)));
    find('next').addEventListener('click', () => select(shiftAgendaDay(day, 1)));
    find('today').addEventListener('click', () => select(agendaToday()));
    date.addEventListener('change', () => select(date.value));
    retry.addEventListener('click', () => {
        // El botón se oculta al cargar; conservar un destino de foco estable.
        find('day').focus();
        void load();
    });
    showDate();
    controls();
    return { onInvalidate: invalidate, onAuthorized(value) { access = value; void load(); } };
}
