// Exclusivo de pruebas y preview local; nunca importado por producción.
export const consultationsFixture = ['pending', 'converted', 'cancelled'].map((status, index) => ({
    id: `fixture-request-${index}`,
    program: { id: 'fixture-program', code: 'fixture-language', name: 'Programa de idiomas de prueba' },
    fullName: `Solicitante de Prueba ${index + 1}`,
    phone: '0000000000',
    email: index ? null : 'solicitante@example.invalid',
    city: 'Ciudad de prueba',
    mode: ['online', 'phone', 'office'][index],
    preferredDate: '2026-10-10',
    preferredTime: '09:30:00',
    message: index ? null : 'Mensaje ficticio para verificar la bandeja de solicitudes.',
    status,
    createdAt: '2026-10-06T02:30:00Z',
}));
