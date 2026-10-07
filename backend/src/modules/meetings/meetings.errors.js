import { AppError } from '../../errors/app-error.js';

const errors = {
    INVALID_REQUEST: [400, 'Los datos de la solicitud no son válidos.'],
    INVALID_CONSULTATION_ID: [400, 'El identificador de la solicitud no es válido.'],
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
    WORKFLOW_ISOLATION_NOT_SUPPORTED: [500, 'Ocurrió un error interno en el servidor.'],
    INTERNAL_ERROR: [500, 'Ocurrió un error interno en el servidor.'],
};

const rpcCodes = new Set([
    'INVALID_REQUEST', 'INVALID_MEETING_INPUT', 'ACTOR_NOT_ALLOWED',
    'CONSULTATION_NOT_FOUND', 'CONSULTATION_CANCELLED', 'CONSULTATION_ALREADY_SCHEDULED',
    'CONSULTATION_COMPLETED', 'CONSULTATION_STATE_INCONSISTENT', 'IDEMPOTENCY_KEY_REUSED',
    'ASSIGNEE_NOT_ELIGIBLE', 'INVALID_TIME_ZONE', 'INVALID_LOCAL_TIME',
    'MEETING_NOT_IN_FUTURE', 'WORKFLOW_ISOLATION_NOT_SUPPORTED',
]);

export class MeetingError extends AppError {
    constructor(code) {
        const safeCode = Object.hasOwn(errors, code) ? code : 'INTERNAL_ERROR';
        super(errors[safeCode][0], errors[safeCode][1], safeCode);
    }
}

export function translateMeetingError(error) {
    return new MeetingError(error?.code === 'P0001' && rpcCodes.has(error.message)
        ? error.message : 'INTERNAL_ERROR');
}
