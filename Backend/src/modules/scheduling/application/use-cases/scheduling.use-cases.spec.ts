import {
  FakeAccountStanding,
  FakePlanEntitlements,
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { Appointment } from '../../domain/appointment.entity';
import {
  MAX_ACTIVE_ONLINE_BOOKINGS_PER_CONTACT,
  MAX_ONLINE_BOOKINGS_PER_DAY,
} from '../../domain/booking-limits';
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
  let plan: FakePlanEntitlements;
  let tenant: FakeTenantContext;
  let appointments: InMemoryAppointmentRepository;
  let schedules: InMemoryScheduleRepository;
  let timeOffs: InMemoryTimeOffRepository;
  let settingsRepo: InMemoryBookingSettingsRepository;
  let catalog: FakeSchedulingCatalog;
  let contacts: FakeSchedulingContacts;
  let events: RecordingEventBus;
  let standing: FakeAccountStanding;
  const ids = new SequentialIdGenerator();
  let keys: SequentialBookingKeys;
  const uow = new ImmediateUnitOfWork();
  const monday = nextMonday();
  const at = (time: string, date = monday) =>
    zonedToUtc(date, Number(time.slice(0, 2)) * 60 + Number(time.slice(3)), SP);

  beforeEach(() => {
    plan = new FakePlanEntitlements();
    tenant = new FakeTenantContext('tenant-a');
    keys = new SequentialBookingKeys();
    appointments = new InMemoryAppointmentRepository(tenant);
    schedules = new InMemoryScheduleRepository(tenant);
    timeOffs = new InMemoryTimeOffRepository(tenant);
    settingsRepo = new InMemoryBookingSettingsRepository(tenant);
    catalog = new FakeSchedulingCatalog(tenant);
    contacts = new FakeSchedulingContacts();
    events = new RecordingEventBus();
    standing = new FakeAccountStanding();
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
    new UpdateBookingSettingsUseCase(settingsRepo, keys, settings(), plan).execute({
      enabled: true,
    });

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

  it('turning online booking on needs it in the plan (already on keeps working)', async () => {
    await enableOnline();
    plan.missing.add('onlineBooking');
    await expect(enableOnline()).resolves.toBeDefined();
    settingsRepo.items.splice(0);
    await expect(enableOnline()).rejects.toMatchObject({ code: 'PLAN_FEATURE_ONLINE_BOOKING' });
  });

  describe('online booking (site)', () => {
    const resolve = () => new ResolveBookingKey(settingsRepo, tenant, standing);
    const publicBook = (
      input: {
        startsAt: Date;
        professionalId?: string | null;
        phone?: string | null;
        email?: string | null;
      },
      unitOfWork: ImmediateUnitOfWork = uow,
    ) =>
      new PublicBookUseCase(
        resolve(),
        availability(),
        appointments,
        catalog,
        contacts,
        ids,
        events,
        unitOfWork,
      ).execute('agenda-1', {
        serviceId: SERVICE,
        professionalId: input.professionalId ?? null,
        startsAt: input.startsAt,
        name: 'Joana',
        phone: input.phone === undefined ? '(15) 98888-1111' : input.phone,
        email: input.email ?? null,
        notes: null,
      });

    /**
     * Imita o rollback do banco para o que importa aqui: o contato criado
     * dentro de `run` some se o trabalho lançar erro. Prova que a captura do
     * contato acontece DENTRO da transação do agendamento.
     */
    class RollbackUnitOfWork extends ImmediateUnitOfWork {
      override async run<T>(work: () => Promise<T>): Promise<T> {
        const before = contacts.contacts.length;
        try {
          return await super.run(work);
        } catch (error) {
          contacts.contacts.splice(before);
          throw error;
        }
      }
    }

    /** Agendamento pelo site já gravado, de outro contato, criado em `createdAt`. */
    const siteAppointment = (n: number, createdAt: Date) =>
      Appointment.restore(`old-${n}`, {
        tenantId: 'tenant-a',
        professionalId: `pro-outro-${n}`,
        serviceId: SERVICE,
        serviceName: 'Corte',
        priceCents: 5000,
        contactId: `contact-outro-${n}`,
        startsAt: at('09:00', addDays(monday, 1)),
        endsAt: at('10:00', addDays(monday, 1)),
        status: 'canceled', // cancelado conta: o teto é de marcações
        source: 'site',
        notes: null,
        cancelReason: null,
        createdBy: null,
        createdAt,
        updatedAt: createdAt,
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

    describe('limits (P0 7)', () => {
      it('the same phone holds at most N upcoming site bookings; nothing is written past it', async () => {
        await enableOnline();
        expect(MAX_ACTIVE_ONLINE_BOOKINGS_PER_CONTACT).toBe(2);
        await publicBook({ startsAt: at('09:00') });
        // Mesmo número digitado de outro jeito: é o mesmo contato.
        await publicBook({ startsAt: at('10:00'), phone: '15988881111' });
        const before = appointments.items.length;
        await expect(publicBook({ startsAt: at('11:00') })).rejects.toMatchObject({
          code: 'BOOKING_CONTACT_LIMIT',
          limit: MAX_ACTIVE_ONLINE_BOOKINGS_PER_CONTACT,
        });
        expect(appointments.items).toHaveLength(before);
        expect(events.published.filter((e) => e instanceof AppointmentBookedEvent)).toHaveLength(2);

        // Outro telefone marca normalmente.
        await publicBook({ startsAt: at('11:00'), phone: '(15) 97777-2222' });
      });

      it('appointments booked by the team do not count against the site limit', async () => {
        await enableOnline();
        contacts.contacts.push({ id: 'contact-joana', name: 'Joana', phone: '+5515988881111' });
        for (const time of ['09:00', '10:00', '11:00']) {
          await new BookAppointmentUseCase(
            appointments,
            catalog,
            contacts,
            new FakeSchedulingMembers(),
            tenant,
            ids,
            events,
            uow,
          ).execute({
            professionalId: ANA,
            serviceId: SERVICE,
            contactId: 'contact-joana',
            startsAt: at(time),
            notes: null,
          });
        }
        const { appointment } = await publicBook({ startsAt: at('14:00') });
        expect(appointment.contactId).toBe('contact-joana');
      });

      it('the account takes at most M site bookings a day (canceled ones count, yesterday does not)', async () => {
        await enableOnline();
        const yesterday = new Date(Date.now() - 36 * 3_600_000);
        appointments.items.push(siteAppointment(0, yesterday));
        for (let n = 1; n < MAX_ONLINE_BOOKINGS_PER_DAY; n++) {
          appointments.items.push(siteAppointment(n, new Date()));
        }
        // Falta uma para o teto: esta passa.
        await publicBook({ startsAt: at('09:00') });
        const captured = contacts.captured.length;
        await expect(
          publicBook({ startsAt: at('10:00'), phone: '(15) 97777-2222' }),
        ).rejects.toMatchObject({ code: 'BOOKING_DAILY_LIMIT', limit: MAX_ONLINE_BOOKINGS_PER_DAY });
        // Recusado antes de procurar ou criar o contato.
        expect(contacts.captured).toHaveLength(captured);
      });

      it('the contact is created inside the booking transaction: no booking, no contact', async () => {
        await enableOnline();
        const rollback = new RollbackUnitOfWork();
        const contactsBefore = contacts.contacts.length;
        // O horário foi tomado entre o cálculo e a gravação, nos dois profissionais.
        jest.spyOn(appointments, 'save').mockRejectedValue(new AppointmentConflictError());
        await expect(publicBook({ startsAt: at('09:00') }, rollback)).rejects.toThrow(
          AppointmentConflictError,
        );
        expect(contacts.captured.length).toBeGreaterThan(0); // tentou, dentro da transação
        expect(contacts.contacts).toHaveLength(contactsBefore); // e o rollback levou
        expect(rollback.runs).toBe(2); // Ana e Bia, cada uma na sua transação
      });

      it('every attempt takes the account lock before counting (concurrent bookings line up)', async () => {
        await enableOnline();
        await publicBook({ startsAt: at('09:00') });
        expect(appointments.locks).toBe(1);
      });
    });

    describe('suspended account (P0 8)', () => {
      it('the widget, the slots and the booking answer as if online booking were off', async () => {
        const enabled = await enableOnline();
        standing.suspended.add('tenant-a');
        tenant.switchTo(null);
        await expect(
          new GetBookingPageUseCase(resolve(), catalog).execute(enabled.publicKey),
        ).rejects.toThrow(BookingNotFoundError);
        await expect(
          new PublicSlotsUseCase(resolve(), availability()).execute(enabled.publicKey, {
            serviceId: SERVICE,
            professionalId: null,
            date: monday,
          }),
        ).rejects.toThrow(BookingNotFoundError);
        await expect(publicBook({ startsAt: at('09:00') })).rejects.toThrow(BookingNotFoundError);
        expect(contacts.captured).toEqual([]);

        // Reativada: a mesma chave volta a funcionar, nada foi perdido.
        standing.suspended.delete('tenant-a');
        await publicBook({ startsAt: at('09:00') });
      });
    });
  });
});
