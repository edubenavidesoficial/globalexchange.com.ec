import { createHash } from 'node:crypto';
import { createConsultationMeeting, findMeetings } from './meetings.repository.js';
import { URLSearchParams } from 'node:url';
import { AppError } from '../../errors/app-error.js';
import { MeetingError, translateMeetingError } from './meetings.errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = new Set(['date', 'time', 'timeZone', 'durationMinutes', 'mode', 'assignedTo', 'notes']);

// RFC3339 con precisión PostgreSQL (microsegundos), sin normalización de
// calendarios imposibles ni dependencia de la zona horaria del servidor.
function timestamp(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?([Zz]|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match || match[0] !== value) return null;
    const [, y, mo, d, h, mi, s, fraction = '', zone] = match;
    const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] ||
        hour > 23 || minute > 59 || second > 59 || zone === '-00:00') return null;
    let offset = 0;
    if (!/^[Zz]$/.test(zone)) {
        const oh = Number(zone.slice(1, 3)), om = Number(zone.slice(4, 6));
        if (oh > 23 || om > 59) return null;
        offset = (oh * 60 + om) * (zone[0] === '+' ? 1 : -1);
    }
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute - offset, second, 0);
    if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return null;
    return { utc: date.toISOString().slice(0, 19) + '.' + fraction.padEnd(6, '0') + 'Z',
        micros: BigInt(date.getTime()) * 1000n + BigInt(fraction.padEnd(6, '0')) };
}

export async function listMeetings(rawQuery, viewer) {
    const params = new URLSearchParams(rawQuery);
    const from = timestamp(params.get('from')), to = timestamp(params.get('to'));
    if (params.size !== 2 || params.getAll('from').length !== 1 || params.getAll('to').length !== 1 ||
        !from || !to || from.micros >= to.micros || to.micros - from.micros > 45n * 86400n * 1000000n) {
        throw new AppError(400, 'Se requieren from y to con zona explícita y un rango positivo de hasta 45 días.');
    }
    const isUUID = value => typeof value === 'string' && value.length === 36 && UUID.test(value);
    if (!viewer || !isUUID(viewer.id) || !['admin', 'agendadora', 'vendedora'].includes(viewer.role)) {
        throw new AppError(403, 'No tienes permisos para consultar reuniones.');
    }
    const assignedUserId = viewer.role === 'vendedora' ? viewer.id : null;
    const rows = await findMeetings({ fromUTC: from.utc, toUTC: to.utc, assignedUserId });
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const text = value => typeof value === 'string' && value.trim().length > 0;
    const positive = value => Number.isInteger(value) && value > 0;
    if (!Array.isArray(rows) || rows.some(row => {
        if (!object(row)) return true;
        const c = row.consultation, p = c?.program, a = row.assigned_user;
        const time = timestamp(row.scheduled_at);
        return !isUUID(row.id) || !isUUID(row.consultation_request_id) || !time ||
            time.micros < from.micros || time.micros >= to.micros || !text(row.time_zone) ||
            !positive(row.duration_minutes) || !positive(row.version) ||
            !['online', 'phone', 'office'].includes(row.mode) ||
            !['scheduled', 'completed', 'cancelled', 'no_show'].includes(row.status) ||
            !object(c) || !isUUID(c.id) || c.id.toLowerCase() !== row.consultation_request_id.toLowerCase() ||
            !text(c.full_name) || !text(c.phone) || !(c.email === null || typeof c.email === 'string') ||
            !object(p) || !isUUID(p.id) || !text(p.code) || !text(p.name) ||
            !object(a) || !isUUID(a.id) || !text(a.full_name) ||
            (assignedUserId !== null && a.id.toLowerCase() !== assignedUserId.toLowerCase());
    })) throw new Error('Invalid meetings response');
    return rows.map(row => ({
        id: row.id, consultationRequestId: row.consultation_request_id,
        scheduledAt: row.scheduled_at, timeZone: row.time_zone, durationMinutes: row.duration_minutes,
        mode: row.mode, status: row.status, version: row.version,
        consultation: { id: row.consultation.id, fullName: row.consultation.full_name,
            phone: row.consultation.phone, email: row.consultation.email,
            program: { id: row.consultation.program.id, code: row.consultation.program.code, name: row.consultation.program.name } },
        assignedTo: { id: row.assigned_user.id, fullName: row.assigned_user.full_name },
    }));
}

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
