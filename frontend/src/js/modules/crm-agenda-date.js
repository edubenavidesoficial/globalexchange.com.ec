export const agendaTimeZone = 'America/Guayaquil';

export function agendaToday(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en', { timeZone: agendaTimeZone,
        year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = name => parts.find(item => item.type === name).value;
    return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}

function calendar(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day) return null;
    return date;
}

export function shiftAgendaDay(value, days) {
    const date = calendar(value);
    if (!date || !Number.isInteger(days)) return null;
    date.setUTCDate(date.getUTCDate() + days);
    if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return null;
    // UTC se usa solo para aritmética calendario, no para convertir el día elegido.
    return date.toISOString().slice(0, 10);
}

export function agendaDayRange(day) {
    const next = shiftAgendaDay(day, 1);
    if (!next) return null;
    // Día operativo actual de Ecuador continental: UTC-05:00.
    return { from: `${day}T00:00:00-05:00`, to: `${next}T00:00:00-05:00` };
}

export function agendaDayLabel(day) {
    const range = agendaDayRange(day);
    if (!range) return '';
    return new Intl.DateTimeFormat('es-EC', { timeZone: agendaTimeZone,
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(range.from));
}

export function agendaHour(timestamp) {
    return new Intl.DateTimeFormat('es-EC', { timeZone: agendaTimeZone,
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(timestamp));
}
