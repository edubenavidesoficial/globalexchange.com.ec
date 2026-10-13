import { getInternal, postInternal, InternalMutationError } from './internal.js';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUUID = value => typeof value === 'string' && value.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const required = ['date', 'time', 'timeZone', 'durationMinutes', 'mode', 'assignedTo'];
const allowed = new Set([...required, 'notes']);

const nonBlank = value => typeof value === 'string' && value.trim().length > 0;
const agendaOptions = new Set(['from', 'to', 'access', 'signal']);
// Solo estructura de transporte; el backend valida calendario, zona y rango.
const isTimestamp = value => typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) &&
    !/[\r\n]/.test(value);

function isAgendaMeeting(meeting) {
    if (!isObject(meeting)) return false;
    const { consultation, assignedTo } = meeting;
    const program = consultation?.program;
    return isUUID(meeting.id) && isUUID(meeting.consultationRequestId) &&
        isTimestamp(meeting.scheduledAt) && nonBlank(meeting.timeZone) &&
        Number.isInteger(meeting.durationMinutes) && meeting.durationMinutes > 0 &&
        ['online', 'phone', 'office'].includes(meeting.mode) &&
        ['scheduled', 'completed', 'cancelled', 'no_show'].includes(meeting.status) &&
        Number.isInteger(meeting.version) && meeting.version > 0 &&
        isObject(consultation) && isUUID(consultation.id) && nonBlank(consultation.fullName) &&
        typeof consultation.phone === 'string' &&
        (consultation.email === null || typeof consultation.email === 'string') &&
        isObject(program) && isUUID(program.id) && nonBlank(program.code) && nonBlank(program.name) &&
        isObject(assignedTo) && isUUID(assignedTo.id) && nonBlank(assignedTo.fullName);
}

export async function getAgendaMeetings(options) {
    if (!isObject(options) || Reflect.ownKeys(options).some(field => !agendaOptions.has(field)) ||
        !nonBlank(options.from) || !nonBlank(options.to) ||
        !isObject(options.access) || !isObject(options.access.session) ||
        !nonBlank(options.access.session.user?.id) || !nonBlank(options.access.session.access_token) ||
        typeof options.access.isCurrent !== 'function' || !(options.access.signal instanceof AbortSignal) ||
        (options.signal !== undefined && !(options.signal instanceof AbortSignal))) {
        throw new InternalMutationError('invalid_input');
    }
    const { from, to, access, signal = new AbortController().signal } = options;
    const response = await getInternal('/api/admin/meetings', access, signal, { from, to });
    if (!isObject(response) || !Array.isArray(response.data) || !response.data.every(isAgendaMeeting)) {
        throw new InternalMutationError('invalid_response');
    }
    // Copias explícitas en cada nivel, sin filtrar ni reordenar filas.
    return response.data.map(meeting => ({
        id: meeting.id, consultationRequestId: meeting.consultationRequestId,
        scheduledAt: meeting.scheduledAt, timeZone: meeting.timeZone,
        durationMinutes: meeting.durationMinutes, mode: meeting.mode,
        status: meeting.status, version: meeting.version,
        consultation: {
            id: meeting.consultation.id, fullName: meeting.consultation.fullName,
            phone: meeting.consultation.phone, email: meeting.consultation.email,
            program: { id: meeting.consultation.program.id, code: meeting.consultation.program.code,
                name: meeting.consultation.program.name },
        },
        assignedTo: { id: meeting.assignedTo.id, fullName: meeting.assignedTo.fullName },
    }));
}

// El caller crea una clave por intento y conserva clave + payload en memoria.
export function createMeetingIdempotencyKey() {
    return crypto.randomUUID();
}

export async function getAvailableSalespeople(access, signal) {
    const body = await getInternal('/api/admin/internal-users', access, signal, {
        role: 'vendedora', active: 'true',
    });
    if (!Array.isArray(body?.data) || body.data.some(user => !isObject(user) ||
        !isUUID(user.id) || typeof user.fullName !== 'string' || !user.fullName.trim() ||
        user.role !== 'vendedora')) throw new InternalMutationError('invalid_response');
    return body.data.map(({ id, fullName, role }) => ({ id, fullName, role }));
}

export async function createConsultationMeeting({ consultationId, idempotencyKey, payload, access, signal }) {
    if (!isUUID(consultationId) || !isUUID(idempotencyKey) || !isObject(payload) ||
        required.some(field => !Object.hasOwn(payload, field)) ||
        Object.keys(payload).some(field => !allowed.has(field)) ||
        typeof payload.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) || payload.date.length !== 10 ||
        typeof payload.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.time) || payload.time.length !== 5 ||
        typeof payload.timeZone !== 'string' || !payload.timeZone.trim() ||
        !Number.isInteger(payload.durationMinutes) || payload.durationMinutes <= 0 ||
        !['online', 'phone', 'office'].includes(payload.mode) || !isUUID(payload.assignedTo) ||
        (payload.notes !== undefined && payload.notes !== null && typeof payload.notes !== 'string')) {
        throw new InternalMutationError('invalid_input');
    }
    // Copia explícita: nunca serializar actor, hash, estado o auditoría del caller.
    const body = Object.fromEntries(required.map(field => [field, payload[field]]));
    if (payload.notes !== undefined) body.notes = payload.notes;
    const response = await postInternal(`/api/admin/consultations/${consultationId}/meeting`,
        access, signal, body, idempotencyKey);
    if (!isObject(response?.data) || !isObject(response.data.consultation) || !isObject(response.data.meeting)) {
        throw new InternalMutationError('invalid_response');
    }
    return response.data;
}
