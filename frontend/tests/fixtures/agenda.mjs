// Solo tests y preview local. Sin datos personales reales.
export function agendaFixture(day = '2026-10-13') {
    return ['scheduled', 'completed', 'cancelled', 'no_show'].map((status, index) => ({
        id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
        consultationRequestId: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
        scheduledAt: `${day}T${['09:30', '11:00', '14:00', '16:30'][index]}:00-05:00`,
        timeZone: 'America/Guayaquil', durationMinutes: [45, 30, 60, 45][index],
        mode: ['online', 'phone', 'office', 'online'][index], status, version: 1,
        consultation: { id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
            fullName: ['Andrea de Prueba', 'Daniel de Prueba', 'Camila de Prueba', 'Mateo de Prueba'][index],
            phone: '000 000 0000', email: index === 1 ? null : 'contacto@example.invalid',
            program: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', code: 'SYNTH',
                name: ['Idiomas en el extranjero', 'Educación en el exterior', 'Formación profesional', 'Programa de idiomas'][index] } },
        assignedTo: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', fullName: 'Vendedora de Prueba' },
    }));
}
