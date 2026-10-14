import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agendaToday, agendaDayRange, shiftAgendaDay, agendaDayLabel, agendaHour } from '../src/js/modules/crm-agenda-date.js';

for (const [instant, day] of [['2026-10-14T04:59:59Z', '2026-10-13'], ['2026-10-14T05:00:00Z', '2026-10-14'],
    ['2027-01-01T01:00:00+09:00', '2026-12-31']]) test(`Agenda hoy Ecuador ${instant}`, () => {
    assert.equal(agendaToday(new Date(instant)), day);
});
for (const [day, delta, next] of [['2026-10-13', -1, '2026-10-12'], ['2026-10-13', 1, '2026-10-14'],
    ['2026-10-31', 1, '2026-11-01'], ['2026-01-01', -1, '2025-12-31'],
    ['2026-12-31', 1, '2027-01-01'], ['2028-02-28', 1, '2028-02-29'], ['2028-02-29', 1, '2028-03-01'],
    ['2027-03-01', -1, '2027-02-28']]) test(`Agenda calendario ${day} ${delta}`, () => {
    assert.equal(shiftAgendaDay(day, delta), next);
    assert.deepEqual(agendaDayRange(day), { from: `${day}T00:00:00-05:00`, to: `${shiftAgendaDay(day, 1)}T00:00:00-05:00` });
});
for (const day of ['', '2027-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '9999-12-31', null]) {
    test(`Agenda rechaza fecha no representable ${day}`, () => assert.equal(agendaDayRange(day), null));
}
test('Agenda formato español y hora de instante absoluto', () => {
    assert.equal(agendaDayLabel('2026-10-13'), 'martes, 13 de octubre de 2026');
    assert.equal(agendaHour('2026-10-13T14:30:00+00:00'), '09:30');
    assert.equal(agendaHour('2026-10-13T05:00:00Z'), '00:00');
});
