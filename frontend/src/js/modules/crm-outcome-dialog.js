import { completeMeeting, markMeetingNoShow, createMeetingIdempotencyKey } from '../api/meetings.js';

const operations = new Map([['completed', completeMeeting], ['no_show', markMeetingNoShow]]);
const conflicts = new Map([
    ['MEETING_NOT_SCHEDULED', 'Esta reunión ya tiene otro estado. Actualizaremos la Agenda.'],
    ['MEETING_VERSION_CONFLICT', 'La reunión cambió desde que la abriste. Revisa la información actualizada.'],
    ['CONSULTATION_STATE_INCONSISTENT', 'La solicitud necesita revisión administrativa antes de continuar.'],
    ['IDEMPOTENCY_KEY_REUSED', 'No se pudo continuar con este intento. Actualiza la Agenda antes de volver a intentarlo.'],
    ['MEETING_NOT_FOUND', 'La reunión ya no está disponible.'],
]);

export function initOutcomeDialog(root, { reload, forbid, canOpen }) {
    const find = name => root.querySelector(`[data-outcome-${name}]`);
    const dialog = find('dialog'), form = find('form'), choice = form.elements.namedItem('outcome');
    let current = null;
    const valid = state => current === state && state.access.isCurrent() && !state.controller.signal.aborted;
    function controls(state) {
        dialog.setAttribute('aria-busy', String(state.sending));
        form.setAttribute('aria-busy', String(state.sending));
        find('fields').disabled = state.sending || state.uncertain || state.blocked;
        find('confirm').disabled = state.sending || state.blocked;
        find('confirm').textContent = state.sending ? 'Registrando…' : state.uncertain ? 'Reintentar el mismo resultado' : 'Confirmar resultado';
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
        form.reset(); choice.value = '';
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
            if (!form.checkValidity() || !operations.has(choice.value)) {
                find('message').textContent = 'Selecciona Completada o No asistió.';
                form.reportValidity(); return;
            }
            // La operación también pertenece al intento: nunca releer el selector al reintentar.
            state.attempt = Object.freeze({ operation: operations.get(choice.value),
                meetingId: state.id, idempotencyKey: createMeetingIdempotencyKey(),
                payload: Object.freeze({ expectedVersion: state.version }) });
        }
        state.sending = true; controls(state);
        find('message').textContent = 'Registrando resultado…';
        try {
            const { operation, meetingId, idempotencyKey, payload } = state.attempt;
            await operation({ meetingId, idempotencyKey, payload, access: state.access, signal: state.controller.signal });
            if (!valid(state)) return;
            // El snapshot de mutación no sustituye el GET enriquecido.
            refresh('Resultado registrado. Actualizando el día seleccionado…');
        } catch (error) {
            if (!valid(state)) return;
            if (['expired', 'denied', 'stale'].includes(error?.code)) {
                close(false);
                if (error.code === 'stale') state.access.revalidate(); else state.access.blockAccess();
                return;
            }
            if (error?.code === 'forbidden') {
                state.attempt = null; state.uncertain = false; state.blocked = true; forbid();
                find('message').textContent = 'No tienes permiso para registrar el resultado de esta reunión.';
            } else if (error?.code === 'operation' && [404, 409].includes(error.status)) {
                refresh(conflicts.get(error.domainCode) || 'La reunión cambió. Actualizaremos la Agenda antes de continuar.');
            } else if (error?.code === 'operation' && error.status === 422 && error.domainCode === 'MEETING_TOO_EARLY') {
                state.attempt = null; state.uncertain = false;
                find('message').textContent = 'Todavía no se puede registrar este resultado. Inténtalo cuando corresponda según el horario de la reunión.';
            } else if (error?.code === 'invalid_input' || (error?.code === 'operation' && error.status === 400)) {
                state.attempt = null; state.uncertain = false;
                find('message').textContent = 'Revisa el resultado seleccionado o actualiza la Agenda antes de continuar.';
            } else {
                state.uncertain = true;
                find('message').textContent = error?.domainCode === 'WORKFLOW_ISOLATION_NOT_SUPPORTED'
                    ? 'No fue posible procesar la operación. Si continúa, solicita revisión al administrador.'
                    : 'No pudimos confirmar el resultado. Puedes reintentar el mismo envío.';
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
            // Las reuniones visibles de vendedora ya están limitadas por el GET autorizado.
            if (current || !canOpen() || !access?.isCurrent() || !['admin', 'vendedora'].includes(access.user?.role) || meeting.status !== 'scheduled') return;
            const state = { access, opener, id: meeting.id, version: meeting.version,
                controller: new AbortController(), attempt: null, sending: false, uncertain: false, blocked: false };
            current = state;
            form.reset(); choice.value = '';
            find('announcement').textContent = find('message').textContent = '';
            find('client').textContent = meeting.consultation.fullName;
            find('program').textContent = meeting.consultation.program.name;
            find('seller').textContent = meeting.assignedTo?.fullName || 'Sin asignar';
            find('status').textContent = 'Agendada';
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
            (state.blocked ? find('back') : choice).focus();
        },
    };
}
