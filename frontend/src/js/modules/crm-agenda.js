import { getAgendaMeetings } from '../api/meetings.js';
import { initCancelDialog } from './crm-cancel-dialog.js';
import { initRescheduleDialog } from './crm-reschedule-dialog.js';
import { initOutcomeDialog } from './crm-outcome-dialog.js';
import { agendaToday, shiftAgendaDay, agendaDayRange, agendaDayLabel, agendaHour } from './crm-agenda-date.js';

const modes = { online: 'En línea', phone: 'Teléfono', office: 'Oficina' };
const statuses = { scheduled: 'Agendada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió' };
const instances = new WeakMap();
const sellerId = meeting => typeof meeting.assignedTo?.id === 'string' ? meeting.assignedTo.id.trim().toLowerCase() : '';
function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
}

export function initCRMAgenda() {
    const root = document.querySelector('[data-agenda]');
    if (!root) return;
    if (instances.has(root)) return instances.get(root);
    const find = name => root.querySelector(`[data-agenda-${name}]`);
    const rows = find('rows'), date = find('date'), retry = find('retry');
    let day = agendaToday();
    let access = null;
    let pending = null;
    let generation = 0;
    let reschedulingDenied = false;
    let cancellationDenied = false;
    let outcomeDenied = false;
    let refreshRequired = false;
    let loadedData = null;
    const filters = { state: '', seller: '' };
    const stateSelect = find('filter-state'), sellerSelect = find('filter-seller');
    const canFilterSeller = () => ['admin', 'agendadora'].includes(access?.user?.role);
    const available = () => Boolean(access?.isCurrent()) && !pending && !refreshRequired;
    const canOpen = () => available() &&
        !root.querySelector('[data-reschedule-dialog]').open && !root.querySelector('[data-cancel-dialog]').open &&
        !root.querySelector('[data-outcome-dialog]').open;
    function reload() {
        // Conservar el anuncio del diálogo que acaba de cerrar.
        if (root.querySelector('[data-reschedule-dialog]').open) dialog.invalidate();
        if (root.querySelector('[data-cancel-dialog]').open) cancellation.invalidate();
        if (root.querySelector('[data-outcome-dialog]').open) outcome.invalidate();
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
    const outcome = initOutcomeDialog(root, {
        canOpen: () => canOpen() && !outcomeDenied,
        forbid() { outcomeDenied = true; controls(); },
        reload,
    });

    function clear() {
        loadedData = null;
        sellerSelect.replaceChildren(Object.assign(node('option', 'Todas las vendedoras'), { value: '' }));
        find('filter-count').textContent = '';
        find('filter-count').hidden = true;
        find('filter-notice').textContent = '';
        rows.replaceChildren();
        find('overview').hidden = true;
        for (const count of root.querySelectorAll('[data-agenda-count]')) count.textContent = '';
        find('priority-title').textContent = '';
        find('priority-copy').textContent = '';
        find('priority-meeting').replaceChildren();
        find('summary').textContent = '';
        find('status').textContent = '';
        retry.hidden = true;
    }
    function controls() {
        find('filters').disabled = !access || Boolean(pending) || loadedData === null;
        find('seller-label').hidden = !canFilterSeller();
        sellerSelect.disabled = !canFilterSeller();
        root.setAttribute('aria-busy', String(Boolean(pending)));
        date.disabled = !access;
        find('previous').disabled = !access || !agendaDayRange(shiftAgendaDay(day, -1));
        find('next').disabled = !access || !agendaDayRange(shiftAgendaDay(day, 1));
        // Sigue disponible si la pestaña permanece abierta al cambiar de día.
        find('today').disabled = !access;
        retry.disabled = !access || Boolean(pending);
        for (const button of rows.querySelectorAll('[data-agenda-reschedule]')) button.disabled = !available() || reschedulingDenied;
        for (const button of rows.querySelectorAll('[data-agenda-cancel]')) button.disabled = !available() || cancellationDenied;
        for (const button of rows.querySelectorAll('[data-agenda-outcome]')) button.disabled = !available() || outcomeDenied;
    }
    function showDate() {
        date.value = day;
        find('day').textContent = agendaDayLabel(day);
    }
    function invalidate() {
        dialog.invalidate();
        cancellation.invalidate();
        outcome.invalidate();
        outcomeDenied = false;
        reschedulingDenied = false; cancellationDenied = false; refreshRequired = false;
        generation++;
        pending?.abort();
        pending = null;
        access = null;
        filters.state = filters.seller = '';
        stateSelect.value = '';
        clear();
        controls();
    }
    function renderOverview(data) {
        // El GET ya ordena por scheduled_at e id. Conservar ese orden, incluso
        // empates con precisión PostgreSQL, y las referencias usadas por diálogos.
        const today = day === agendaToday();
        find('priority-title').textContent = today ? '¿Qué tengo que hacer hoy?' : 'Organiza las reuniones de este día';
        find('priority-copy').textContent = today
            ? 'Consulta tus reuniones de hoy y gestiona los cambios de horario.'
            : 'Consulta el horario y los estados de la fecha seleccionada.';
        // Solo orientación al cargar; el reloj no interviene en permisos.
        const next = data.find(meeting => meeting.status === 'scheduled' &&
            (!today || new Date(meeting.scheduledAt).getTime() >= Date.now()));
        const priority = find('priority-meeting');
        priority.replaceChildren();
        if (next) {
            priority.append(node('span', today ? 'Próxima agendada · al cargar' : 'Primera agendada del día', 'agenda-priority-label'),
                node('strong', `${agendaHour(next.scheduledAt)} · ${next.consultation.fullName}`),
                node('span', next.consultation.program.name));
        } else {
            priority.append(node('strong', today ? 'Sin próximas reuniones agendadas' : 'Sin reuniones agendadas'),
                node('span', 'En las reuniones cargadas para este día.'));
        }
        for (const count of root.querySelectorAll('[data-agenda-count]')) {
            count.textContent = String(count.dataset.agendaCount === 'total' ? data.length
                : data.filter(meeting => meeting.status === count.dataset.agendaCount).length);
        }
        find('overview').hidden = false;
        find('summary').textContent = `${data.length} ${data.length === 1 ? 'reunión' : 'reuniones'}`;
    }
    function renderRows(data) {
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
            field('Vendedora', meeting.assignedTo?.fullName?.trim() || 'Sin asignar');
            field('Teléfono', meeting.consultation.phone);
            if (meeting.consultation.email) field('Email', meeting.consultation.email);
            const badge = node('span', statuses[meeting.status], `agenda-badge agenda-badge--${meeting.status}`);
            item.append(time, person, badge, details);
            const actions = node('div', undefined, 'agenda-meeting-actions');
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
                actions.append(button, cancel);
            }
            if (['admin', 'vendedora'].includes(access.user.role) && meeting.status === 'scheduled') {
                const button = node('button', 'Registrar resultado', 'crm-button crm-button--primary');
                button.type = 'button'; button.dataset.agendaOutcome = '';
                button.setAttribute('aria-label', `Registrar resultado de la reunión de ${meeting.consultation.fullName}`);
                const owner = access, renderedGeneration = generation;
                button.addEventListener('click', () => {
                    if (canOpen() && !outcomeDenied && owner === access && renderedGeneration === generation) outcome.open(meeting, owner, button);
                });
                actions.append(button);
            }
            if (actions.childElementCount) item.append(actions);
            fragment.append(item);
        }
        rows.replaceChildren(fragment);
    }
    function applyFilters() {
        if (loadedData === null || !access?.isCurrent()) return;
        const visible = loadedData.filter(meeting => (!filters.state || meeting.status === filters.state) &&
            (!canFilterSeller() || !filters.seller || sellerId(meeting) === filters.seller));
        renderRows(visible);
        find('filter-count').hidden = false;
        find('filter-count').textContent = `Mostrando ${visible.length} de ${loadedData.length} reuniones cargadas del día`;
        find('status').textContent = !loadedData.length ? 'No hay reuniones cargadas para este día.'
            : !visible.length ? 'Ninguna reunión coincide con los filtros. Puedes limpiar los filtros.'
                : `${visible.length} ${visible.length === 1 ? 'reunión visible' : 'reuniones visibles'}.`;
        controls();
    }
    function acceptData(data) {
        loadedData = data;
        const sellers = new Map();
        if (canFilterSeller()) for (const meeting of data) {
            const id = sellerId(meeting), name = meeting.assignedTo?.fullName;
            if (id && typeof name === 'string' && name.trim()) sellers.set(id, name);
        }
        for (const [id, name] of sellers) sellerSelect.append(Object.assign(node('option', name), { value: id }));
        if (filters.seller && !sellers.has(filters.seller)) {
            filters.seller = '';
            if (canFilterSeller()) find('filter-notice').textContent = 'La vendedora seleccionada ya no está en las reuniones cargadas. Se restableció Todas las vendedoras.';
        }
        sellerSelect.value = filters.seller;
        renderOverview(data);
        applyFilters();
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
            acceptData(data);
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
        outcome.invalidate();
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
    function updateFilters() {
        if (!available() || loadedData === null || !canOpen()) return;
        filters.state = stateSelect.value;
        filters.seller = canFilterSeller() ? sellerSelect.value : '';
        find('filter-notice').textContent = '';
        applyFilters();
    }
    stateSelect.addEventListener('change', updateFilters);
    sellerSelect.addEventListener('change', updateFilters);
    find('clear-filters').addEventListener('click', () => {
        if (!available() || loadedData === null || !canOpen()) return;
        stateSelect.value = sellerSelect.value = '';
        updateFilters();
    });
    // El guard limpia en pagehide/logout; BFCache reutiliza estos mismos hooks.
    const hooks = { onInvalidate: invalidate, onAuthorized(value) { access = value; void load(); } };
    instances.set(root, hooks);
    return hooks;
}
