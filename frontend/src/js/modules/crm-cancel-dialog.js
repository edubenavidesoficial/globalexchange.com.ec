import { cancelMeeting, createMeetingIdempotencyKey } from '../api/meetings.js';

const reasons = new Set(['client_request', 'staff_unavailable', 'duplicate', 'administrative', 'other']);
const conflictMessages = new Map([
    ['MEETING_VERSION_CONFLICT', 'La reunión cambió desde que la abriste. Actualizando la Agenda…'],
    ['MEETING_NOT_SCHEDULED', 'La reunión ya no está programada. Actualizando la Agenda…'],
    ['MEETING_NOT_FOUND', 'La reunión ya no está disponible. Actualizando la Agenda…'],
    ['IDEMPOTENCY_KEY_REUSED', 'Ese intento no pudo completarse. Actualizando la Agenda antes de continuar…'],
    ['CONSULTATION_STATE_INCONSISTENT', 'La solicitud requiere revisión administrativa. Actualizando la Agenda…'],
]);

export function initCancelDialog(root, { reload, forbid, canOpen }) {
    const find = name => root.querySelector(`[data-cancel-${name}]`);
    const dialog = find('dialog'), form = find('form'), reason = form.elements.namedItem('reason');
    let current = null;
    const valid = state => current === state && state.access.isCurrent() && !state.controller.signal.aborted;
    function controls(state) {
        dialog.setAttribute('aria-busy', String(state.sending));
        form.setAttribute('aria-busy', String(state.sending));
        find('fields').disabled = state.sending || state.uncertain || state.blocked;
        find('confirm').disabled = state.sending || state.blocked;
        find('confirm').textContent = state.sending ? 'Cancelando…' : state.uncertain ? 'Reintentar cancelación' : 'Confirmar cancelación';
        find('back').disabled = state.sending || state.uncertain;
        find('discard').hidden = !state.uncertain;
        find('discard').disabled = state.sending;
        find('uncertain').hidden = !state.uncertain;
    }
    function close(restoreFocus = true) {
        const old = current, opener = old?.opener;
        current = null;
        old?.controller.abort();
        if (old) { old.attempt = null; old.id = null; old.version = null; old.opener = null; }
        if (dialog.open) dialog.close();
        form.reset(); reason.value = '';
        for (const name of ['client', 'program', 'seller', 'schedule', 'status', 'zone', 'message']) find(name).textContent = '';
        find('fields').disabled = false;
        find('discard').hidden = find('uncertain').hidden = true;
        dialog.setAttribute('aria-busy', 'false'); form.setAttribute('aria-busy', 'false');
        if (restoreFocus && opener?.isConnected && !opener.disabled) opener.focus();
        else if (restoreFocus && old?.access.isCurrent()) root.querySelector('[data-agenda-day]').focus();
    }
    function refresh(message) {
        close(false);
        find('announcement').textContent = message;
        root.querySelector('[data-agenda-day]').focus();
        void reload();
    }
    async function submit(event) {
        event.preventDefault();
        const state = current;
        if (!state || !valid(state) || state.sending || state.blocked) return;
        if (!state.attempt) {
            if (!form.checkValidity() || !reasons.has(reason.value)) {
                find('message').textContent = 'Selecciona un motivo de cancelación.';
                form.reportValidity(); return;
            }
            const payload = Object.freeze({ expectedVersion: state.version, reason: reason.value });
            state.attempt = Object.freeze({ meetingId: state.id, idempotencyKey: createMeetingIdempotencyKey(), payload });
        }
        state.sending = true; controls(state);
        find('message').textContent = 'Cancelando reunión…';
        try {
            // No renderizar el snapshot PATCH (puede tener año 10000). La lista procede del GET.
            await cancelMeeting({ ...state.attempt, access: state.access, signal: state.controller.signal });
            if (!valid(state)) return;
            refresh('Reunión cancelada. Actualizando el día seleccionado…');
        } catch (error) {
            if (!valid(state)) return;
            if (['expired', 'denied', 'stale'].includes(error?.code)) {
                close(false);
                if (error.code === 'stale') state.access.revalidate(); else state.access.blockAccess();
                return;
            }
            if (error?.code === 'forbidden') {
                state.attempt = null; state.uncertain = false; state.blocked = true; forbid();
                find('message').textContent = 'No tienes permiso para cancelar reuniones.';
            } else if (error?.code === 'operation' && [404, 409].includes(error.status)) {
                refresh(conflictMessages.get(error.domainCode) || 'La información de la reunión cambió. Actualizando la Agenda antes de continuar…');
            } else if (error?.code === 'invalid_input' || (error?.code === 'operation' && error.status === 400)) {
                state.attempt = null; state.uncertain = false;
                find('message').textContent = 'Revisa el motivo de cancelación y los datos de la reunión antes de confirmar nuevamente.';
            } else {
                state.uncertain = true;
                find('message').textContent = 'No pudimos confirmar el resultado. Reintenta con el mismo motivo o descarta el intento y actualiza la Agenda.';
            }
        } finally {
            if (valid(state)) { state.sending = false; controls(state); }
        }
    }
    form.addEventListener('submit', event => void submit(event));
    const back = () => { if (current && !current.sending && !current.uncertain) close(); };
    find('back').addEventListener('click', back);
    dialog.addEventListener('cancel', event => { event.preventDefault(); back(); });
    find('discard').addEventListener('click', () => {
        if (current?.uncertain && !current.sending) refresh('Intento descartado. Actualizando la Agenda antes de continuar…');
    });
    return {
        invalidate() { close(false); find('announcement').textContent = ''; },
        open(meeting, access, opener) {
            if (current || !canOpen() || !access?.isCurrent() || !['admin', 'agendadora'].includes(access.user?.role) || meeting.status !== 'scheduled') return;
            const state = { access, opener, id: meeting.id, version: meeting.version,
                controller: new AbortController(), attempt: null, sending: false, uncertain: false, blocked: false };
            current = state;
            form.reset(); reason.value = '';
            find('announcement').textContent = find('message').textContent = '';
            find('client').textContent = meeting.consultation.fullName;
            find('program').textContent = meeting.consultation.program.name;
            find('seller').textContent = meeting.assignedTo.fullName;
            find('status').textContent = 'Programada';
            find('zone').textContent = `Zona horaria de la reunión: ${meeting.timeZone}`;
            try {
                find('schedule').textContent = new Intl.DateTimeFormat('es-EC', { timeZone: meeting.timeZone,
                    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
                }).format(new Date(meeting.scheduledAt));
            } catch {
                state.blocked = true;
                find('message').textContent = 'No fue posible representar la fecha de esta reunión. Vuelve y actualiza la Agenda.';
            }
            controls(state); dialog.showModal();
            (state.blocked ? find('back') : reason).focus();
        },
    };
}
