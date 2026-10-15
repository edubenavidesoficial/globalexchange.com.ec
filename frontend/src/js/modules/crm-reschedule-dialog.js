import { createMeetingIdempotencyKey, rescheduleMeeting } from '../api/meetings.js';

// La Agenda se agrupa por día de Ecuador; el comando conserva la zona de la reunión.
function localSchedule(meeting) {
    const parts = new Intl.DateTimeFormat('en', { timeZone: meeting.timeZone,
        calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(meeting.scheduledAt));
    const get = type => parts.find(part => part.type === type).value;
    return { date: `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function initRescheduleDialog(root, { reload, forbid, canOpen }) {
    const find = name => root.querySelector(`[data-reschedule-${name}]`);
    const dialog = find('dialog'), form = find('form');
    const field = name => form.elements.namedItem(name);
    let current = null;
    const valid = state => current === state && state.access.isCurrent() && !state.controller.signal.aborted;
    function controls(state) {
        dialog.setAttribute('aria-busy', String(state.sending));
        form.setAttribute('aria-busy', String(state.sending));
        find('fields').disabled = state.sending || state.uncertain || state.blocked;
        find('confirm').disabled = state.sending || state.blocked;
        find('confirm').textContent = state.sending ? 'Reprogramando…' : state.uncertain ? 'Reintentar reprogramación' : 'Confirmar reprogramación';
        find('cancel').disabled = state.sending || state.uncertain;
        find('discard').hidden = !state.uncertain;
        find('discard').disabled = state.sending;
        find('uncertain').hidden = !state.uncertain;
    }
    function close(restoreFocus = true) {
        const old = current, opener = old?.opener;
        current = null;
        old?.controller.abort();
        if (old) { old.attempt = null; old.id = null; old.version = null; old.timeZone = null; old.opener = null; }
        if (dialog.open) dialog.close();
        form.reset();
        for (const name of ['date', 'time', 'durationMinutes', 'mode']) field(name).value = '';
        for (const name of ['client', 'program', 'seller', 'status', 'schedule', 'zone', 'message']) find(name).textContent = '';
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
            const payload = { date: field('date').value, time: field('time').value, timeZone: state.timeZone,
                durationMinutes: Number(field('durationMinutes').value), mode: field('mode').value, expectedVersion: state.version };
            if (!form.checkValidity() || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.time) ||
                !Number.isInteger(payload.durationMinutes) || payload.durationMinutes < 1 || !['online', 'phone', 'office'].includes(payload.mode)) {
                find('message').textContent = 'Completa fecha, hora, modalidad y una duración entera positiva.';
                form.reportValidity(); return;
            }
            state.attempt = Object.freeze({ meetingId: state.id, idempotencyKey: createMeetingIdempotencyKey(), payload: Object.freeze(payload) });
        }
        state.sending = true; controls(state);
        find('message').textContent = 'Reprogramando reunión…';
        try {
            await rescheduleMeeting({ ...state.attempt, access: state.access, signal: state.controller.signal });
            if (!valid(state)) return;
            refresh('Reunión reprogramada. Actualizando el día seleccionado…');
        } catch (error) {
            if (!valid(state)) return;
            if (['expired', 'denied', 'stale'].includes(error?.code)) {
                close(false);
                if (error.code === 'stale') state.access.revalidate(); else state.access.blockAccess();
                return;
            }
            if (error?.code === 'forbidden') {
                state.attempt = null; state.uncertain = false; state.blocked = true; forbid();
                find('message').textContent = 'No tienes permiso para reprogramar reuniones.';
            } else if (error?.code === 'operation' && [404, 409].includes(error.status)) {
                refresh('La reunión cambió desde que la abriste. Actualizamos la Agenda para mostrar la información más reciente.');
            } else if (error?.code === 'invalid_input' || (error?.code === 'operation' && [400, 422].includes(error.status))) {
                state.attempt = null; state.uncertain = false;
                const messages = {
                    MEETING_NOT_IN_FUTURE: 'Elige una fecha y hora futuras para la reunión.',
                    INVALID_TIME_ZONE: 'No fue posible usar la zona horaria de esta reunión. Revisa los datos o actualiza la Agenda.',
                    INVALID_LOCAL_TIME: 'La hora seleccionada no existe en la zona de esta reunión. Elige otra hora.',
                };
                find('message').textContent = messages[error.domainCode] || 'Revisa la fecha, hora, duración y modalidad antes de confirmar nuevamente.';
            } else {
                // Un fallo incluso posterior al PATCH puede ocultar un cambio persistido.
                state.uncertain = true;
                find('message').textContent = 'No pudimos confirmar el resultado. Reintenta con los mismos datos o descarta el intento y actualiza la Agenda.';
            }
        } finally {
            if (valid(state)) { state.sending = false; controls(state); }
        }
    }
    form.addEventListener('submit', event => void submit(event));
    const cancel = () => { if (current && !current.sending && !current.uncertain) close(); };
    find('cancel').addEventListener('click', cancel);
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    find('discard').addEventListener('click', () => {
        if (current?.uncertain && !current.sending) refresh('Intento descartado. Actualizando la Agenda antes de continuar…');
    });
    return {
        invalidate() { close(false); find('announcement').textContent = ''; },
        open(meeting, access, opener) {
            if (current || !canOpen() || !access?.isCurrent() || !['admin', 'agendadora'].includes(access.user?.role) || meeting.status !== 'scheduled') return;
            const state = { access, opener, id: meeting.id, version: meeting.version, timeZone: meeting.timeZone,
                controller: new AbortController(), attempt: null, sending: false, uncertain: false, blocked: false };
            current = state;
            find('announcement').textContent = '';
            find('client').textContent = meeting.consultation.fullName;
            find('program').textContent = meeting.consultation.program.name;
            find('seller').textContent = meeting.assignedTo.fullName;
            find('status').textContent = 'Programada';
            find('zone').textContent = `Zona horaria de la reunión: ${meeting.timeZone}`;
            try {
                const local = localSchedule(meeting);
                field('date').value = local.date; field('time').value = local.time;
                find('schedule').textContent = `${local.date} · ${local.time}`;
            } catch {
                state.blocked = true;
                find('message').textContent = 'No fue posible representar la fecha en la zona de esta reunión. Cierra y actualiza la Agenda.';
            }
            field('durationMinutes').value = String(meeting.durationMinutes); field('mode').value = meeting.mode;
            controls(state); dialog.showModal();
            (state.blocked ? find('cancel') : field('date')).focus();
        },
    };
}
