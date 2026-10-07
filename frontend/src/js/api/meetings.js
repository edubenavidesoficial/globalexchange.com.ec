import { getInternal, postInternal, InternalMutationError } from './internal.js';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUUID = value => typeof value === 'string' && value.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const required = ['date', 'time', 'timeZone', 'durationMinutes', 'mode', 'assignedTo'];
const allowed = new Set([...required, 'notes']);

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
