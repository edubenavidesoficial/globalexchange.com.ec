import { AppError } from '../../errors/app-error.js';

const errors = {
    INVALID_REQUEST: [400, 'Los datos de la solicitud no son válidos.'],
    INVALID_CONSULTATION_ID: [400, 'El identificador de la solicitud no es válido.'],
    INVALID_MEETING_ID: [400, 'El identificador de la reunión no es válido.'],
    MEETING_NOT_FOUND: [404, 'La reunión no existe.'],
    MEETING_NOT_SCHEDULED: [409, 'Solo se puede reprogramar una reunión programada.'],
    MEETING_VERSION_CONFLICT: [409, 'La reunión cambió. Vuelve a consultar sus datos.'],
    INVALID_IDEMPOTENCY_KEY: [400, 'Se requiere una única Idempotency-Key con formato UUID.'],
    INVALID_MEETING_INPUT: [400, 'Los datos de la reunión no son válidos.'],
    ACTOR_NOT_ALLOWED: [403, 'No tienes permisos para confirmar reuniones.'],
    CONSULTATION_NOT_FOUND: [404, 'La solicitud no existe.'],
    CONSULTATION_CANCELLED: [409, 'La solicitud está cancelada.'],
    CONSULTATION_ALREADY_SCHEDULED: [409, 'La solicitud ya tiene una reunión programada.'],
    CONSULTATION_COMPLETED: [409, 'La solicitud ya tiene una reunión completada.'],
    CONSULTATION_STATE_INCONSISTENT: [409, 'La solicitud requiere revisión antes de agendar.'],
    IDEMPOTENCY_KEY_REUSED: [409, 'La clave de idempotencia ya corresponde a otros datos.'],
    ASSIGNEE_NOT_ELIGIBLE: [422, 'La persona asignada no es una vendedora activa disponible para asignación.'],
    INVALID_TIME_ZONE: [422, 'La zona horaria no es válida.'],
    INVALID_LOCAL_TIME: [422, 'La hora no existe en la zona horaria indicada.'],
    MEETING_NOT_IN_FUTURE: [422, 'La reunión debe estar en el futuro.'],
    MEETING_TOO_EARLY: [422, 'Aún no se puede registrar este resultado de la reunión.'],
    WORKFLOW_ISOLATION_NOT_SUPPORTED: [500, 'Ocurrió un error interno en el servidor.'],
    INTERNAL_ERROR: [500, 'Ocurrió un error interno en el servidor.'],
};

const rpcCodes = new Set([
    'INVALID_REQUEST', 'INVALID_MEETING_INPUT', 'ACTOR_NOT_ALLOWED',
    'CONSULTATION_NOT_FOUND', 'CONSULTATION_CANCELLED', 'CONSULTATION_ALREADY_SCHEDULED',
    'CONSULTATION_COMPLETED', 'CONSULTATION_STATE_INCONSISTENT', 'IDEMPOTENCY_KEY_REUSED',
    'ASSIGNEE_NOT_ELIGIBLE', 'INVALID_TIME_ZONE', 'INVALID_LOCAL_TIME',
    'MEETING_NOT_IN_FUTURE', 'MEETING_TOO_EARLY', 'WORKFLOW_ISOLATION_NOT_SUPPORTED',
    'MEETING_NOT_FOUND', 'MEETING_NOT_SCHEDULED', 'MEETING_VERSION_CONFLICT', 'INTERNAL_ERROR',
]);

const cancellationMessages = {
    ACTOR_NOT_ALLOWED: 'No tienes permisos para cancelar reuniones.',
    MEETING_NOT_SCHEDULED: 'Solo se puede cancelar una reunión programada.',
    CONSULTATION_STATE_INCONSISTENT: 'La solicitud requiere revisión antes de cancelar la reunión.',
};

const outcomeMessages = {
    ACTOR_NOT_ALLOWED: 'No tienes permisos para registrar el resultado de esta reunión.',
    MEETING_NOT_SCHEDULED: 'Solo se puede registrar el resultado de una reunión programada.',
    CONSULTATION_STATE_INCONSISTENT: 'La solicitud requiere revisión antes de registrar el resultado de la reunión.',
};

export class MeetingError extends AppError {
    constructor(code, context) {
        const safeCode = Object.hasOwn(errors, code) ? code : 'INTERNAL_ERROR';
        const messages = context === 'cancel' ? cancellationMessages : context === 'outcome' ? outcomeMessages : null;
        const message = messages && Object.hasOwn(messages, safeCode)
            ? messages[safeCode] : errors[safeCode][1];
        super(errors[safeCode][0], message, safeCode);
    }
}

export function translateMeetingError(error, context) {
    return new MeetingError(error?.code === 'P0001' && rpcCodes.has(error.message)
        ? error.message : 'INTERNAL_ERROR', context);
}
