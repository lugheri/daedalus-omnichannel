import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { AppointmentConflictError } from '../../domain/errors/appointment-conflict.error';
import { BookingNotFoundError } from '../../domain/errors/booking-not-found.error';
import { AppointmentBookedEvent } from '../../domain/events/appointment-booked.event';
import {
  addDays,
  localDateOf,
  localMinutesOf,
  weekdayOf,
  zonedToUtc,
} from '../../domain/zoned-time';
import {
  FakeSchedulingCatalog,
  FakeSchedulingContacts,
  FakeSchedulingMembers,
  InMemoryAppointmentRepository,
  InMemoryBookingSettingsRepository,
  InMemoryScheduleRepository,
  InMemoryTimeOffRepository,
  SequentialBookingKeys,
} from '../../testing/fakes';
import { AgendaSettings } from '../agenda-settings';
import { Availability } from '../availability';
import {
  AgendaFreeSlotsUseCase,
  BookAppointmentUseCase,
  ChangeAppointmentStatusUseCase,
  ListAgendaDayUseCase,
  UpdateAppointmentUseCase,
} from './agenda.use-cases';
import {
  GetBookingPageUseCase,
  GetBookingSettingsUseCase,
  PublicBookUseCase,
  PublicSlotsUseCase,
  ResolveBookingKey,
  UpdateBookingSettingsUseCase,
} from './booking.use-cases';
import { AddTimeOffUseCase, SetWeeklyHoursUseCase } from './schedules.use-cases';

const SP = 'America/Sao_Paulo';
const SERVICE = 'svc-corte';
const ANA = 'pro-ana';
const BIA = 'pro-bia';

/** A próxima segunda-feira daqui a pelo menos 3 dias (dentro da janela do site). */
function nextMonday(): string {
  let date = addDays(localDateOf(new Date(), SP), 3);
  while (weekdayOf(date) !== 1) date = addDays(date, 1);
  return date;
}
const hhmm = (instant: Date) => {
  const m = localMinutesOf(instant, SP);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

describe('Scheduling', () => {
  let tenant: FakeTenantContext;
  let appointments: InMemoryAppointmentRepository;
  let schedules: InMemoryScheduleRepository;
  let timeOffs: InMemoryTimeOffRepository;
  let settingsRepo: InMemoryBookingSettingsRepository;
  let catalog: FakeSchedulingCatalog;
  let contacts: FakeSchedulingContacts;
  let events: RecordingEventBus;
  const ids = new SequentialIdGenerator();
  let keys: SequentialBookingKeys;
  const uow = new ImmediateUnitOfWork();
  const monday = nextMonday();
  const at = (time: string, date = monday) =>
    zonedToUtc(date, Number(time.slice(0, 2)) * 60 + Number(time.slice(3)), SP);

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    keys = new SequentialBookingKeys();
    appointments = new InMemoryAppointmentRepository(tenant);
    schedules = new InMemoryScheduleRepository(tenant);
    timeOffs = new InMemoryTimeOffRepository(tenant);
    settingsRepo = new InMemoryBookingSettingsRepository(tenant);
    catalog = new FakeSchedulingCatalog(tenant);
    contacts = new FakeSchedulingContacts();
    events = new RecordingEventBus();
    contacts.contacts.push({ id: 'contact-1', name: 'Carlos', phone: '+5515999990000' });
    catalog.byTenant.set('tenant-a', {
      services: [
        {
          id: SERVICE,
          name: 'Corte',
          durationMinutes: 60,
          priceCents: 5000,
          showOnSite: true,
          active: true,
        },
        {
          id: 'svc-interno',
          name: 'Interno',
          durationMinutes: 30,
          priceCents: null,
          showOnSite: false,
          active: true,
        },
      ],
      professionals: [
        {
          id: ANA,
          name: 'Ana',
          offeringIds: [SERVICE, 'svc-interno'],
          showOnSite: true,
          active: true,
        },
        { id: BIA, name: 'Bia', offeringIds: [SERVICE], showOnSite: true, active: true },
      ],
    });
  });

  const settings = () => new AgendaSettings(settingsRepo, keys, tenant);
  const availability = () => new Availability(appointments, schedules, timeOffs, catalog);
  const book = (input: { professionalId?: string; startsAt: Date; serviceId?: string }) =>
    new BookAppointmentUseCase(
      appointments,
      catalog,
      contacts,
      new FakeSchedulingMembers(),
      tenant,
      ids,
      events,
      uow,
    ).execute({
      professionalId: input.professionalId ?? ANA,
      serviceId: input.serviceId ?? SERVICE,
      contactId: 'contact-1',
      startsAt: input.startsAt,
      notes: null,
    });
  const panelSlots = (professionalId: string | null = ANA, date = monday) =>
    new AgendaFreeSlotsUseCase(availability(), settings()).execute({
      serviceId: SERVICE,
      professionalId,
      date,
    });
  const enableOnline = () =>
    new UpdateBookingSettingsUseCase(settingsRepo, keys, settings()).execute({ enabled: true });

  describe('panel', () => {
    it('free slots come from the default week until hours are set', async () => {
      const slots = await panelSlots();
      expect(slots.map((s) => hhmm(s.startsAt))).toEqual([
        '09:00',
        '09:30',
        '10:00',
        '10:30',
        '11:00',
        '13:00',
        '13:30',
        '14:00',
        '14:30',
        '15:00',
        '15:30',
        '16:00',
        '16:30',
        '17:00',
      ]);
      const week = Array.from({ length: 7 }, () => [] as { start: number; end: number }[]);
      week[1] = [{ start: 14 * 60, end: 16 * 60 }];
      await new SetWeeklyHoursUseCase(schedules, catalog).execute(ANA, week);
      expect((await panelSlots()).map((s) => hhmm(s.startsAt))).toEqual([
        '14:00',
        '14:30',
        '15:00',
      ]);
    });

    it('bookings and time off take the slots away; overlap is refused', async () => {
      await book({ startsAt: at('09:00') });
      await new AddTimeOffUseCase(timeOffs, catalog, tenant, ids).execute({
        professionalId: ANA,
        startsAt: at('13:00'),
        endsAt: at('18:00'),
        reason: 'Médico',
      });
      const slots = (await panelSlots()).map((s) => hhmm(s.startsAt));
      expect(slots).toEqual(['10:00', '10:30', '11:00']);
      await expect(book({ startsAt: at('09:30') })).rejects.toThrow(AppointmentConflictError);
      // Outra profissional, mesmo horário: pode.
      await expect(book({ professionalId: BIA, startsAt: at('09:30') })).resolves.toBeDefined();
      expect(events.published.filter((e) => e instanceof AppointmentBookedEvent)).toHaveLength(2);
    });

    it('"anyone" merges the free professionals per slot', async () => {
      await book({ startsAt: at('09:00') });
      const [first] = await panelSlots(null);
      expect(hhmm(first.startsAt)).toBe('09:00');
      expect(first.professionalIds).toEqual([BIA]);
    });

    it('a professional must do the service; status changes free the slot', async () => {
      await expect(
        book({ professionalId: BIA, serviceId: 'svc-interno', startsAt: at('09:00') }),
      ).rejects.toMatchObject({ code: 'APPOINTMENT_SERVICE_NOT_OFFERED' });
      const appointment = await book({ startsAt: at('09:00') });
      await new ChangeAppointmentStatusUseCase(appointments).execute(
        appointment.id,
        'canceled',
        'Desmarcou',
      );
      expect((await panelSlots()).map((s) => hhmm(s.startsAt))).toContain('09:00');
      // Desfazer o cancelamento esbarra em quem ocupou o horário.
      await book({ startsAt: at('09:00') });
      await expect(
        new ChangeAppointmentStatusUseCase(appointments).execute(appointment.id, 'scheduled', null),
      ).rejects.toThrow(AppointmentConflictError);
    });

    it('reschedules keeping the duration; the day lists everything with the hours', async () => {
      const appointment = await book({ startsAt: at('09:00') });
      const moved = await new UpdateAppointmentUseCase(appointments, catalog).execute(
        appointment.id,
        {
          startsAt: at('16:00'),
          professionalId: BIA,
        },
      );
      expect(hhmm(moved.endsAt)).toBe('17:00');
      const day = await new ListAgendaDayUseCase(
        appointments,
        schedules,
        timeOffs,
        catalog,
        contacts,
        settings(),
      ).execute(monday);
      expect(day.appointments).toHaveLength(1);
      expect(day.professionals.find((p) => p.id === BIA)?.hours).toHaveLength(2);
      expect(day.contacts.get('contact-1')?.name).toBe('Carlos');
      tenant.switchTo('tenant-b');
      expect(
        (
          await new ListAgendaDayUseCase(
            appointments,
            schedules,
            timeOffs,
            catalog,
            contacts,
            settings(),
          ).execute(monday)
        ).appointments,
      ).toHaveLength(0);
    });
  });

  describe('online booking (site)', () => {
    const resolve = () => new ResolveBookingKey(settingsRepo, tenant);
    const publicBook = (input: { startsAt: Date; professionalId?: string | null }) =>
      new PublicBookUseCase(
        resolve(),
        availability(),
        appointments,
        catalog,
        contacts,
        ids,
        events,
        uow,
      ).execute('agenda-1', {
        serviceId: SERVICE,
        professionalId: input.professionalId ?? null,
        startsAt: input.startsAt,
        name: 'Joana',
        phone: '(15) 98888-1111',
        email: null,
        notes: null,
      });

    it('is off until the account turns it on; the key finds the account', async () => {
      const get = new GetBookingSettingsUseCase(settingsRepo, settings());
      expect((await get.execute()).saved).toBe(false);
      await expect(
        new GetBookingPageUseCase(resolve(), catalog).execute('agenda-1'),
      ).rejects.toThrow(BookingNotFoundError);
      const enabled = await enableOnline();
      expect(await get.execute()).toMatchObject({ saved: true });
      expect((await get.execute()).settings.publicKey).toBe(enabled.publicKey);
      tenant.switchTo(null);
      const page = await new GetBookingPageUseCase(resolve(), catalog).execute(enabled.publicKey);
      expect(tenant.tenantId).toBe('tenant-a');
      expect(page.services.map((s) => s.name)).toEqual(['Corte']);
      expect(page.professionals.map((p) => p.name)).toEqual(['Ana', 'Bia']);
    });

    it('only real free slots inside the window; "anyone" goes to the first free professional', async () => {
      await enableOnline();
      const slots = await new PublicSlotsUseCase(resolve(), availability()).execute('agenda-1', {
        serviceId: SERVICE,
        professionalId: null,
        date: monday,
      });
      expect(slots.length).toBeGreaterThan(0);
      expect(
        await new PublicSlotsUseCase(resolve(), availability()).execute('agenda-1', {
          serviceId: SERVICE,
          professionalId: null,
          date: addDays(monday, 400),
        }),
      ).toEqual([]);

      await book({ startsAt: at('10:00') }); // Ana ocupada às 10h
      const { appointment, professionalName } = await publicBook({ startsAt: at('10:00') });
      expect(professionalName).toBe('Bia');
      expect(appointment.source).toBe('site');
      expect(contacts.captured).toEqual([{ name: 'Joana', phone: '(15) 98888-1111', email: null }]);
      // Ninguém mais livre às 10h.
      await expect(publicBook({ startsAt: at('10:00') })).rejects.toThrow(AppointmentConflictError);
      // Fora do horário semanal (12h, almoço) não é horário do site.
      await expect(publicBook({ startsAt: at('12:00') })).rejects.toThrow(AppointmentConflictError);
    });

    it('needs a name and a phone or e-mail', async () => {
      await enableOnline();
      await expect(
        new PublicBookUseCase(
          resolve(),
          availability(),
          appointments,
          catalog,
          contacts,
          ids,
          events,
          uow,
        ).execute('agenda-1', {
          serviceId: SERVICE,
          professionalId: null,
          startsAt: at('09:00'),
          name: 'Joana',
          phone: null,
          email: ' ',
          notes: null,
        }),
      ).rejects.toMatchObject({ code: 'APPOINTMENT_CONTACT_REQUIRED' });
    });
  });
});
