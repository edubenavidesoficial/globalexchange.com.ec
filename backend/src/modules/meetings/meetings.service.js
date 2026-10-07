import { createHash } from 'node:crypto';
import { createConsultationMeeting } from './meetings.repository.js';
import { MeetingError, translateMeetingError } from './meetings.errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = new Set(['date', 'time', 'timeZone', 'durationMinutes', 'mode', 'assignedTo', 'notes']);

function uuid(value, code) {
    // Formato canónico compatible con los UUID de PostgreSQL; sin coerción ni trim.
    if (typeof value !== 'string' || value.length !== 36 || !UUID.test(value)) throw new MeetingError(code);
    return value.toLowerCase();
}

export function normalizeMeeting(consultationRequestId, body) {
    const id = uuid(consultationRequestId, 'INVALID_CONSULTATION_ID');
    if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some(key => !fields.has(key))) {
        throw new MeetingError('INVALID_REQUEST');
    }
    const invalid = () => { throw new MeetingError('INVALID_MEETING_INPUT'); };
    if (typeof body.date !== 'string' || body.date.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) invalid();
    const [year, month, day] = body.date.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) invalid();
    if (typeof body.time !== 'string' || body.time.length !== 5 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)) invalid();
    if (typeof body.timeZone !== 'string') invalid();
    const timeZone = body.timeZone.trim();
    if (!timeZone || timeZone.length > 100 || /[\u0000-\u001f\u007f]/.test(timeZone)) invalid();
    // Límite representacional de PostgreSQL integer, no límite comercial.
    if (!Number.isInteger(body.durationMinutes) || body.durationMinutes <= 0
        || body.durationMinutes > 2147483647) invalid();
    if (typeof body.mode !== 'string') invalid();
    const mode = body.mode.trim();
    if (!['online', 'phone', 'office'].includes(mode)) invalid();
    const assignedTo = uuid(body.assignedTo, 'INVALID_MEETING_INPUT');
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') invalid();
    const notes = body.notes?.trim() || null;
    // Mismo límite de texto libre que consultation_requests.message en su service.
    if (notes && (notes.length > 2000 || notes.includes('\u0000'))) invalid();

    // Orden fijo: este objeto, y no el body original, define el contrato del hash.
    return { consultationRequestId: id, date: body.date, time: body.time, timeZone,
        durationMinutes: body.durationMinutes, mode, assignedTo, notes };
}

export async function confirmMeeting({ actorId, consultationRequestId, idempotencyKey, body }) {
    const key = uuid(idempotencyKey, 'INVALID_IDEMPOTENCY_KEY');
    const payload = normalizeMeeting(consultationRequestId, body);
    const requestHash = createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
    try {
        return await createConsultationMeeting({ actorId, idempotencyKey: key, requestHash, payload });
    } catch (error) {
        // Nunca propagar detalles, hints, causas ni mensajes arbitrarios de PostgREST.
        throw translateMeetingError(error);
    }
}
