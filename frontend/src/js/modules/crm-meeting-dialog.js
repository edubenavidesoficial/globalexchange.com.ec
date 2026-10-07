import { getAvailableSalespeople, createMeetingIdempotencyKey, createConsultationMeeting } from '../api/meetings.js';

export function initMeetingDialog(root, { reload, forbid, requireRefresh }) {
    const find = name => root.querySelector(`[data-meeting-${name}]`);
    const dialog = find('dialog');
    const form = find('form');
    const field = name => form.elements.namedItem(name);
    let current = null;
    const valid = state => current === state && state.access.isCurrent() && !state.controller.signal.aborted;

    function controls(state) {
        const busy = state.loading || state.sending;
        dialog.setAttribute('aria-busy', String(busy));
        form.setAttribute('aria-busy', String(state.sending));
        find('fields').disabled = state.sending || state.uncertain || state.blocked;
        field('assignedTo').disabled = state.loading || !state.sellers.length;
        find('confirm').disabled = busy || state.blocked || !state.sellers.length;
        find('confirm').textContent = state.uncertain ? 'Reintentar confirmación' : state.sending ? 'Confirmando…' : 'Confirmar reunión';
        find('cancel').disabled = state.sending || state.uncertain;
        find('reload').hidden = !state.loadFailed;
        find('reload').disabled = busy;
        find('discard').hidden = !state.uncertain;
        find('discard').disabled = state.sending;
        find('uncertain').hidden = !state.uncertain;
        find('update').hidden = !state.conflict;
    }
    function close(restoreFocus = true) {
        const old = current;
        const opener = old?.opener;
        current = null;
        old?.controller.abort();
        if (old) { old.attempt = null; old.sellers = []; old.id = null; old.opener = null; }
        if (dialog.open) dialog.close();
        form.reset();
        field('assignedTo').replaceChildren();
        for (const name of ['applicant', 'program', 'message']) find(name).textContent = '';
        find('fields').disabled = false;
        dialog.setAttribute('aria-busy', 'false');
        form.setAttribute('aria-busy', 'false');
        for (const name of ['reload', 'discard', 'uncertain', 'update']) find(name).hidden = true;
        if (restoreFocus && opener?.isConnected && !opener.disabled) opener.focus();
        else if (restoreFocus && old?.access.isCurrent()) root.querySelector('#consultations-title').focus();
    }
    function authFailure(error, state) {
        if (error?.code === 'stale') { state.access.revalidate(); return true; }
        if (['expired', 'denied'].includes(error?.code)) { state.access.blockAccess(); return true; }
        return false;
    }
    async function loadSellers(state) {
        if (!valid(state) || state.loading) return;
        state.loading = true; state.loadFailed = false; state.sellers = [];
        field('assignedTo').replaceChildren();
        find('message').textContent = 'Cargando vendedoras…'; controls(state);
        try {
            const sellers = await getAvailableSalespeople(state.access, state.controller.signal);
            if (!valid(state)) return;
            state.sellers = sellers;
            const placeholder = document.createElement('option');
            placeholder.value = ''; placeholder.textContent = 'Selecciona una vendedora';
            if (sellers.length) field('assignedTo').append(placeholder);
            for (const seller of sellers) {
                const option = document.createElement('option');
                option.value = seller.id; option.textContent = seller.fullName;
                field('assignedTo').append(option);
            }
            find('message').textContent = sellers.length ? 'Selecciona una vendedora para confirmar.' : 'No hay vendedoras disponibles.';
        } catch (error) {
            if (!valid(state) || authFailure(error, state)) return;
            state.loadFailed = true;
            find('message').textContent = 'No fue posible cargar las vendedoras. Intenta nuevamente.';
        } finally {
            if (valid(state)) { state.loading = false; controls(state); }
        }
    }
    async function submit(event) {
        event.preventDefault();
        const state = current;
        if (!state || !valid(state) || state.loading || state.sending || state.blocked || !state.sellers.length) return;
        if (!state.attempt) {
            const payload = {
                date: field('date').value, time: field('time').value, timeZone: 'America/Guayaquil',
                durationMinutes: Number(field('durationMinutes').value), mode: field('mode').value,
                assignedTo: field('assignedTo').value, notes: field('notes').value,
            };
            if (!form.checkValidity() || !Number.isInteger(payload.durationMinutes) || payload.durationMinutes < 1 ||
                !['online', 'phone', 'office'].includes(payload.mode) || !state.sellers.some(s => s.id === payload.assignedTo)) {
                find('message').textContent = 'Completa fecha, hora, modalidad, duración entera positiva y vendedora.';
                form.reportValidity(); return;
            }
            state.attempt = Object.freeze({ idempotencyKey: createMeetingIdempotencyKey(), payload: Object.freeze(payload) });
        }
        state.sending = true; controls(state);
        find('message').textContent = 'Confirmando reunión…';
        try {
            await createConsultationMeeting({ consultationId: state.id, ...state.attempt,
                access: state.access, signal: state.controller.signal });
            if (!valid(state)) return;
            close(false);
            find('announcement').textContent = 'Reunión confirmada. Actualizando la bandeja…';
            await reload();
        } catch (error) {
            if (!valid(state) || authFailure(error, state)) return;
            // También una confirmación de sesión no disponible puede ocurrir tras
            // un POST persistido. Solo un rechazo conocido libera el intento.
            if (!['operation', 'forbidden', 'invalid_input'].includes(error?.code)) {
                state.uncertain = true;
                find('message').textContent = 'No fue posible confirmar si la reunión se registró. Reintenta la confirmación con los mismos datos.';
            } else {
                state.attempt = null; state.uncertain = false;
                if (error?.code === 'forbidden') {
                    state.blocked = true; forbid();
                    find('message').textContent = 'No tienes permiso para agendar reuniones.';
                } else if ([404, 409].includes(error?.status)) {
                    state.blocked = true; state.conflict = true;
                    requireRefresh();
                    find('message').textContent = 'La solicitud cambió y ya no puede confirmarse con estos datos. Actualiza la bandeja e inténtalo nuevamente.';
                } else {
                    find('message').textContent = 'No fue posible confirmar la reunión con los datos seleccionados. Revisa la fecha, hora y vendedora.';
                }
            }
        } finally {
            if (valid(state)) { state.sending = false; controls(state); }
        }
    }
    form.addEventListener('submit', event => void submit(event));
    find('cancel').addEventListener('click', () => { if (current && !current.sending && !current.uncertain) close(); });
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        if (current && !current.sending && !current.uncertain) close();
    });
    find('reload').addEventListener('click', () => { if (current) void loadSellers(current); });
    for (const name of ['discard', 'update']) find(name).addEventListener('click', () => {
        if (!current || current.sending) return;
        requireRefresh();
        close(false); void reload();
    });
    return {
        invalidate() { close(false); find('announcement').textContent = ''; },
        open(item, access, opener) {
            if (current || !access?.isCurrent() || !['admin', 'agendadora'].includes(access.user?.role) || item.status !== 'pending') return;
            const state = { access, opener, id: item.id, controller: new AbortController(), sellers: [], attempt: null,
                loading: false, sending: false, uncertain: false, blocked: false, conflict: false, loadFailed: false };
            current = state;
            find('announcement').textContent = '';
            find('applicant').textContent = item.fullName || '—';
            find('program').textContent = item.program?.name || '—';
            field('date').value = typeof item.preferredDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.preferredDate) ? item.preferredDate : '';
            field('time').value = typeof item.preferredTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(item.preferredTime) ? item.preferredTime.slice(0, 5) : '';
            field('mode').value = ['online', 'phone', 'office'].includes(item.mode) ? item.mode : '';
            field('durationMinutes').value = '45';
            field('notes').value = '';
            controls(state); dialog.showModal(); field('date').focus();
            void loadSellers(state);
        },
    };
}
