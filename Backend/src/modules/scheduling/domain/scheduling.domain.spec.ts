import { Appointment } from './appointment.entity';
import { freeSlots } from './availability';
import { BookingSettings } from './booking-settings.entity';
import { validWeeklyHours } from './weekly-hours';
import { addDays, localDateOf, localMinutesOf, weekdayOf, zonedToUtc } from './zoned-time';

const SP = 'America/Sao_Paulo';

describe('zoned time', () => {
  it('converts local wall time to UTC and back (São Paulo, UTC-3)', () => {
    const instant = zonedToUtc('2030-03-04', 9 * 60 + 30, SP);
    expect(instant.toISOString()).toBe('2030-03-04T12:30:00.000Z');
    expect(localDateOf(instant, SP)).toBe('2030-03-04');
    expect(localMinutesOf(instant, SP)).toBe(9 * 60 + 30);
    // Perto da meia-noite local, a data UTC já é a do dia seguinte.
    expect(localDateOf(new Date('2030-03-05T02:00:00Z'), SP)).toBe('2030-03-04');
  });

  it('handles a zone with daylight saving (New York, March change)', () => {
    expect(zonedToUtc('2030-03-08', 9 * 60, 'America/New_York').toISOString()).toBe(
      '2030-03-08T14:00:00.000Z',
    );
    expect(zonedToUtc('2030-03-11', 9 * 60, 'America/New_York').toISOString()).toBe(
      '2030-03-11T13:00:00.000Z',
    );
  });

  it('weekdays and day arithmetic', () => {
    expect(weekdayOf('2030-03-04')).toBe(1); // segunda
    expect(addDays('2030-02-28', 1)).toBe('2030-03-01');
  });
});

describe('free slots', () => {
  const base = {
    date: '2030-03-04',
    timeZone: SP,
    ranges: [
      { start: 9 * 60, end: 12 * 60 },
      { start: 13 * 60, end: 15 * 60 },
    ],
    stepMinutes: 30,
    notBefore: new Date('2030-01-01T00:00:00Z'),
  };
  const at = (hhmm: string) =>
    zonedToUtc('2030-03-04', Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), SP);
  const local = (slots: Date[]) =>
    slots.map((s) => {
      const m = localMinutesOf(s, SP);
      return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    });

  it('fits the service inside each range, stepping from the range start', () => {
    const slots = freeSlots({ ...base, busy: [], durationMinutes: 60 });
    expect(local(slots)).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '13:00',
      '13:30',
      '14:00',
    ]);
  });

  it('skips busy periods (half-open: ending at 10h frees 10h)', () => {
    const slots = freeSlots({
      ...base,
      busy: [{ start: at('09:30'), end: at('10:00') }],
      durationMinutes: 30,
    });
    expect(local(slots)).toContain('10:00');
    expect(local(slots)).not.toContain('09:30');
    expect(local(slots)).toContain('09:00');
  });

  it('nothing before notBefore', () => {
    const slots = freeSlots({ ...base, busy: [], durationMinutes: 30, notBefore: at('11:00') });
    expect(local(slots)[0]).toBe('11:00');
  });
});

describe('weekly hours, settings and appointment rules', () => {
  it('validates the week', () => {
    const empty = Array.from({ length: 7 }, () => []);
    expect(validWeeklyHours(empty)).toHaveLength(7);
    const day = (ranges: { start: number; end: number }[]) => [ranges, ...empty.slice(1)];
    expect(() => validWeeklyHours(day([{ start: 600, end: 540 }]))).toThrow();
    expect(() =>
      validWeeklyHours(
        day([
          { start: 540, end: 720 },
          { start: 700, end: 800 },
        ]),
      ),
    ).toThrow();
    expect(() => validWeeklyHours(day([{ start: 541, end: 720 }]))).toThrow();
    expect(
      validWeeklyHours(
        day([
          { start: 780, end: 900 },
          { start: 540, end: 720 },
        ]),
      )[0],
    ).toEqual([
      { start: 540, end: 720 },
      { start: 780, end: 900 },
    ]);
    expect(() => validWeeklyHours(empty.slice(1))).toThrow();
  });

  it('settings: valid zone, step, notice and window', () => {
    const settings = BookingSettings.create('t', 'k');
    expect(settings.enabled).toBe(false);
    settings.update({ enabled: true, slotStepMinutes: 15 });
    expect(settings.values).toMatchObject({ enabled: true, slotStepMinutes: 15 });
    expect(() => settings.update({ timezone: 'Lua/Base' })).toThrow();
    expect(() => settings.update({ slotStepMinutes: 7 })).toThrow();
    expect(() => settings.update({ maxDaysAhead: 0 })).toThrow();
  });

  it('appointment: duration from the service, status transitions', () => {
    const appointment = Appointment.book('a1', {
      tenantId: 't',
      professionalId: 'p',
      service: { id: 's', name: 'Corte', priceCents: 4500, durationMinutes: 45 },
      contactId: 'c',
      startsAt: new Date('2030-03-04T12:00:00Z'),
      source: 'panel',
      notes: '  ',
      createdBy: 'm',
    });
    expect(appointment.endsAt.toISOString()).toBe('2030-03-04T12:45:00.000Z');
    expect(appointment.notes).toBeNull();
    expect(appointment.pullEvents()).toHaveLength(1);

    appointment.changeStatus('canceled', 'Cliente pediu');
    expect(appointment.cancelReason).toBe('Cliente pediu');
    expect(() => appointment.changeStatus('completed')).toThrow();
    expect(() => appointment.reschedule({ startsAt: new Date() })).toThrow();
    appointment.changeStatus('scheduled');
    expect(appointment.cancelReason).toBeNull();
    appointment.reschedule({ startsAt: new Date('2030-03-04T15:00:00Z') });
    expect(appointment.endsAt.toISOString()).toBe('2030-03-04T15:45:00.000Z');
  });
});
