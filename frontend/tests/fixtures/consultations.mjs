// Exclusivo de pruebas y preview local; nunca importado por producción.
export const consultationsFixture = ['pending', 'converted', 'cancelled'].map((status, index) => ({
    id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
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
    // Mantener el orden de esta fixture general con fechas distintas.
    createdAt: `2026-10-06T02:30:00.00${3 - index}Z`,
}));

// Contacto compartido deliberadamente: nunca implica identidad de persona.
export const detailFixture = () => consultationsFixture.slice(0, 2).map((item, index) => ({
    ...item, fullName: 'Interesado sintético', phone: '0000000000', email: 'detalle@example.invalid',
    message: index ? 'Otra solicitud independiente.' : 'Primera línea de prueba.\n' + 'Mensaje extenso sintético. '.repeat(150),
}));

export const orderFixture = () => [
    ['Zeta', '2026-01-01T00:00:00Z', 'pending', 'a'],
    ['Álvaro', '2026-01-03T00:00:00Z', 'pending', 'a'],
    ['alvaro', '2026-01-02T00:00:00Z', 'converted', 'b'],
    ['Ñora', '2026-01-02T19:00:00-05:00', 'pending', 'a'],
    ['   ', 'invalid', 'cancelled', 'b'],
    [null, null, 'pending', 'a'],
    ['Beta', 'invalid', 'pending', 'a'],
].map(([fullName, createdAt, status, program], index) => ({
    ...consultationsFixture[0], id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
    fullName, createdAt, status, city: `Registro sintético ${index}`,
    program: { id: program, name: `Programa ${program}` },
}));

export const preciseOrderFixture = timestamps => timestamps.map((createdAt, index) => ({
    ...consultationsFixture[0], createdAt,
    id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, '0')}`,
    fullName: index % 2 ? 'ÁLVARO' : 'alvaro', city: `Registro sintético ${index}`,
}));
