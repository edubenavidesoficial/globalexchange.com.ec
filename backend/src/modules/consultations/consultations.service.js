import { AppError } from '../../errors/app-error.js';
import {
    createConsultationRequest,
    findActiveProgramByCode,
    findConsultations,
} from './consultations.repository.js';

export async function listConsultations() {
    const consultations = await findConsultations();

    return consultations.map((consultation) => ({
        id: consultation.id,
        program: {
            id: consultation.program.id,
            code: consultation.program.code,
            name: consultation.program.name,
        },
        fullName: consultation.full_name,
        phone: consultation.phone,
        email: consultation.email,
        city: consultation.city,
        mode: consultation.mode,
        preferredDate: consultation.preferred_date,
        preferredTime: consultation.preferred_time,
        message: consultation.message,
        status: consultation.status,
        createdAt: consultation.created_at,
    }));
}

const VALID_MODES = new Set([
    'online',
    'phone',
    'office',
]);

function createValidationError(message) {
    return new AppError(400, message);
}

function normalizeText(value, label, maxLength) {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== 'string') {
        throw createValidationError(label + ' debe ser un texto.');
    }

    const normalizedValue = value.trim();

    if (maxLength && normalizedValue.length > maxLength) {
        throw createValidationError(
            label + ' no debe superar los ' + maxLength + ' caracteres.'
        );
    }

    return normalizedValue || null;
}

function validatePreferredDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw createValidationError(
            'La fecha preferida debe tener el formato YYYY-MM-DD.'
        );
    }

    const [year, month, day] = value.split('-').map(Number);
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30,
        31, 31, 30, 31, 30, 31];

    if (year < 1 || month < 1 || month > 12 ||
        day < 1 || day > daysInMonth[month - 1]) {
        throw createValidationError('La fecha preferida debe ser una fecha real.');
    }

    // Compare calendar dates using Ecuador's business timezone, regardless of
    // the server timezone. These preferences do not confirm an appointment.
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Guayaquil',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const today = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const currentDate = today.year + '-' + today.month + '-' + today.day;

    if (value < currentDate) {
        throw createValidationError('La fecha preferida no puede estar en el pasado.');
    }
}

export async function createConsultation(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw createValidationError('Los datos de la consulta no son válidos.');
    }

    const programCode = normalizeText(input.programCode, 'El código del programa', 100);
    const fullName = normalizeText(input.fullName, 'El nombre completo', 150);
    const phone = normalizeText(input.phone, 'El teléfono', 30);
    const email = normalizeText(input.email, 'El correo electrónico', 254);
    const city = normalizeText(input.city, 'La ciudad', 100);
    const mode = normalizeText(input.mode, 'La modalidad');
    const preferredDate = normalizeText(input.preferredDate, 'La fecha preferida');
    const preferredTime = normalizeText(input.preferredTime, 'La hora preferida');
    const message = normalizeText(input.message, 'El mensaje', 2000);

    if (!programCode) {
        throw createValidationError(
            'El programa es obligatorio.'
        );
    }

    if (!fullName) {
        throw createValidationError(
            'El nombre completo es obligatorio.'
        );
    }

    if (!phone) {
        throw createValidationError(
            'El teléfono es obligatorio.'
        );
    }

    if (!city) {
        throw createValidationError(
            'La ciudad es obligatoria.'
        );
    }

    if (!mode || !VALID_MODES.has(mode)) {
        throw createValidationError(
            'La modalidad seleccionada no es válida.'
        );
    }

    if (!preferredDate) {
        throw createValidationError(
            'La fecha preferida es obligatoria.'
        );
    }

    if (!preferredTime) {
        throw createValidationError(
            'La hora preferida es obligatoria.'
        );
    }

    validatePreferredDate(preferredDate);

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) {
        throw createValidationError(
            'La hora preferida debe tener el formato HH:MM de 24 horas.'
        );
    }

    if (email && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) {
        throw createValidationError('El correo electrónico no tiene un formato válido.');
    }

    const program = await findActiveProgramByCode(programCode);

    if (!program) {
        throw createValidationError(
            'El programa seleccionado no existe o no está activo.'
        );
    }

    const consultation = await createConsultationRequest({
        programId: program.id,
        fullName,
        phone,
        email,
        city,
        mode,
        preferredDate,
        preferredTime,
        message,
    });

    return {
        id: consultation.id,
        program: {
            code: program.code,
            name: program.name,
        },
        fullName: consultation.full_name,
        phone: consultation.phone,
        email: consultation.email,
        city: consultation.city,
        mode: consultation.mode,
        preferredDate: consultation.preferred_date,
        preferredTime: consultation.preferred_time,
        message: consultation.message,
        status: consultation.status,
        createdAt: consultation.created_at,
    };
}
