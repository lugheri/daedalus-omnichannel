import { Inject, Injectable } from '@nestjs/common';
import {
  PLAN_ENTITLEMENTS,
  type PlanEntitlements,
} from '../../../../shared/application/plan-entitlements';
import {
  ACCOUNT_STANDING,
  type AccountStanding,
} from '../../../../shared/application/account-standing';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { Appointment } from '../../domain/appointment.entity';
import {
  MAX_ACTIVE_ONLINE_BOOKINGS_PER_CONTACT,
  MAX_ONLINE_BOOKINGS_PER_DAY,
} from '../../domain/booking-limits';
import type { BookingSettings, BookingSettingsValues } from '../../domain/booking-settings.entity';
import { AppointmentConflictError } from '../../domain/errors/appointment-conflict.error';
import { BookingLimitError } from '../../domain/errors/booking-limit.error';
import { BookingNotFoundError } from '../../domain/errors/booking-not-found.error';
import { InvalidAppointmentError } from '../../domain/errors/invalid-appointment.error';
import { addDays, isLocalDate, localDateOf, zonedToUtc } from '../../domain/zoned-time';
import { AgendaSettings } from '../agenda-settings';
import { Availability, bookableFor, type FreeSlot } from '../availability';
import {
  APPOINTMENT_REPOSITORY,
  type AppointmentRepository,
} from '../ports/appointment.repository';
import {
  BOOKING_SETTINGS_REPOSITORY,
  type BookingSettingsRepository,
} from '../ports/booking-settings.repository';
import {
  BOOKING_KEY_GENERATOR,
  SCHEDULING_CATALOG,
  SCHEDULING_CONTACTS,
  type AgendaProfessional,
  type AgendaService,
  type BookingKeyGenerator,
  type SchedulingCatalog,
  type SchedulingContacts,
} from '../ports/scheduling-sources';

// ── configurações (painel) ──────────────────────────────────────────────────

@Injectable()
export class GetBookingSettingsUseCase {
  constructor(
    @Inject(BOOKING_SETTINGS_REPOSITORY) private readonly repository: BookingSettingsRepository,
    private readonly settings: AgendaSettings,
  ) {}

  /** `saved` = já gravada (só então a chave do widget existe de verdade). */
  async execute(): Promise<{ settings: BookingSettings; saved: boolean }> {
    const saved = await this.repository.findCurrent();
    return { settings: saved ?? (await this.settings.current()), saved: saved !== null };
  }
}

/** Liga/desliga o agendamento online, fuso, passo, antecedência, limite; `rotateKey` = chave nova. */
@Injectable()
export class UpdateBookingSettingsUseCase {
  constructor(
    @Inject(BOOKING_SETTINGS_REPOSITORY) private readonly repository: BookingSettingsRepository,
    @Inject(BOOKING_KEY_GENERATOR) private readonly keys: BookingKeyGenerator,
    private readonly settings: AgendaSettings,
    @Inject(PLAN_ENTITLEMENTS) private readonly plan: PlanEntitlements,
  ) {}

  async execute(
    changes: Partial<BookingSettingsValues> & { rotateKey?: boolean },
  ): Promise<BookingSettings> {
    const settings = await this.settings.current();
    // Ligar é o que o plano barra; o que já está ligado continua (ADR 0015).
    if (changes.enabled === true && !settings.enabled) {
      await this.plan.ensureFeature('onlineBooking');
    }
    const { rotateKey, ...values } = changes;
    settings.update(values);
    if (rotateKey) settings.rotateKey(this.keys.generate());
    await this.repository.save(settings);
    return settings;
  }
}

// ── agendamento pelo site (rotas públicas) ─────────────────────────────────

/**
 * A conta pela chave do widget (agendamento online ligado, conta não
 * suspensa); fixa o tenant. Conta suspensa dá o mesmo 404 do agendamento
 * desligado: o widget diz que o agendamento não está disponível, sem expor
 * a situação da conta a quem visita o site.
 */
@Injectable()
export class ResolveBookingKey {
  constructor(
    @Inject(BOOKING_SETTINGS_REPOSITORY) private readonly settings: BookingSettingsRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ACCOUNT_STANDING) private readonly standing: AccountStanding,
  ) {}

  async execute(key: string): Promise<BookingSettings> {
    const settings = await this.settings.findByPublicKeyAsSystem(key);
    if (!settings?.enabled) throw new BookingNotFoundError();
    if (!(await this.standing.acceptsPublicTraffic(settings.tenantId))) {
      throw new BookingNotFoundError();
    }
    this.tenant.enter(settings.tenantId);
    return settings;
  }
}

export interface BookingPage {
  settings: BookingSettings;
  /** Hoje, no fuso da conta. */
  today: string;
  /** Só os que aparecem no site e têm quem os faça. */
  services: AgendaService[];
  professionals: AgendaProfessional[];
}

/** O que o widget mostra: serviços, profissionais e até quando dá para marcar. */
@Injectable()
export class GetBookingPageUseCase {
  constructor(
    private readonly resolve: ResolveBookingKey,
    @Inject(SCHEDULING_CATALOG) private readonly catalog: SchedulingCatalog,
  ) {}

  async execute(key: string): Promise<BookingPage> {
    const settings = await this.resolve.execute(key);
    const { services, professionals } = await this.catalog.load();
    const bookable = services.filter(
      (s) => s.active && s.showOnSite && bookableFor(s, professionals, true).length > 0,
    );
    return {
      settings,
      today: localDateOf(new Date(), settings.timezone),
      services: bookable,
      professionals: professionals.filter(
        (p) => p.active && p.showOnSite && bookable.some((s) => p.offeringIds.includes(s.id)),
      ),
    };
  }
}

/** Dentro da janela do site: de hoje até `maxDaysAhead` dias. */
function withinWindow(settings: BookingSettings, date: string): boolean {
  const today = localDateOf(new Date(), settings.timezone);
  return date >= today && date <= addDays(today, settings.maxDaysAhead);
}

/** Horários livres para o site (com a antecedência mínima). */
@Injectable()
export class PublicSlotsUseCase {
  constructor(
    private readonly resolve: ResolveBookingKey,
    private readonly availability: Availability,
  ) {}

  async execute(
    key: string,
    input: { serviceId: string; professionalId: string | null; date: string },
  ): Promise<FreeSlot[]> {
    const settings = await this.resolve.execute(key);
    if (!isLocalDate(input.date) || !withinWindow(settings, input.date)) return [];
    const { slots } = await this.availability.slots({
      settings: settings.values,
      ...input,
      notBefore: new Date(Date.now() + settings.minNoticeMinutes * 60_000),
      publicOnly: true,
    });
    return slots;
  }
}

/**
 * O cliente marca pelo site: o horário precisa estar livre AGORA (recalculado
 * aqui, não confiado ao navegador); "qualquer profissional" fica com o
 * primeiro livre. Vira contato (origem "Agendamento pelo site") e o
 * agendamento já sai confirmado. Corrida com outro agendamento: o banco barra
 * (409) e, com "qualquer um", tenta o próximo profissional livre.
 *
 * Limites de negócio (`domain/booking-limits.ts`, 422 `BookingLimitError`):
 * teto diário de marcações pelo site por conta e máximo de agendamentos
 * futuros pelo site por contato. Recusado o limite ou o horário, nada é
 * gravado — nem o contato.
 */
@Injectable()
export class PublicBookUseCase {
  constructor(
    private readonly resolve: ResolveBookingKey,
    private readonly availability: Availability,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(SCHEDULING_CATALOG) private readonly catalog: SchedulingCatalog,
    @Inject(SCHEDULING_CONTACTS) private readonly contacts: SchedulingContacts,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    key: string,
    input: {
      serviceId: string;
      professionalId: string | null;
      startsAt: Date;
      name: string;
      phone: string | null;
      email: string | null;
      notes: string | null;
    },
  ): Promise<{ appointment: Appointment; professionalName: string }> {
    const name = input.name.trim().slice(0, 120);
    if (!name) throw new InvalidAppointmentError('APPOINTMENT_CONTACT_REQUIRED');
    if (!input.phone?.trim() && !input.email?.trim()) {
      throw new InvalidAppointmentError('APPOINTMENT_CONTACT_REQUIRED');
    }
    if (Number.isNaN(input.startsAt.getTime())) {
      throw new InvalidAppointmentError('APPOINTMENT_INVALID_TIME');
    }

    const settings = await this.resolve.execute(key);
    const date = localDateOf(input.startsAt, settings.timezone);
    if (!withinWindow(settings, date)) throw new AppointmentConflictError();
    const { service, slots } = await this.availability.slots({
      settings: settings.values,
      serviceId: input.serviceId,
      professionalId: input.professionalId,
      date,
      notBefore: new Date(Date.now() + settings.minNoticeMinutes * 60_000),
      publicOnly: true,
    });
    const slot = slots.find((s) => s.startsAt.getTime() === input.startsAt.getTime());
    if (!slot) throw new AppointmentConflictError();

    const lead = {
      name,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    };
    const startOfToday = zonedToUtc(
      localDateOf(new Date(), settings.timezone),
      0,
      settings.timezone,
    );
    const { professionals } = await this.catalog.load();
    for (const professionalId of slot.professionalIds) {
      let appointment: Appointment;
      try {
        // Tudo numa transação só — limites, contato e agendamento:
        // - o lock serializa as marcações pelo site da conta, então duas
        //   simultâneas do mesmo telefone contam uma depois da outra (sem ele,
        //   as duas leriam "1 de 2" e gravariam; a EXCLUDE do banco só barra
        //   o MESMO profissional no MESMO horário, não o mesmo contato);
        // - o contato é criado aqui dentro: se o limite recusar ou o horário
        //   tiver sido ocupado, o rollback leva o contato junto e nada fica
        //   gravado (antes, o contato nascia mesmo sem agendamento).
        appointment = await this.unitOfWork.run(async () => {
          await this.appointments.lockOnlineBookings();
          const today = await this.appointments.countCreatedSince({
            source: 'site',
            since: startOfToday,
          });
          if (today >= MAX_ONLINE_BOOKINGS_PER_DAY) {
            throw new BookingLimitError('BOOKING_DAILY_LIMIT', MAX_ONLINE_BOOKINGS_PER_DAY);
          }
          const { contactId } = await this.contacts.captureBookingLead(lead);
          const upcoming = await this.appointments.countUpcoming({
            contactId,
            source: 'site',
            after: new Date(),
          });
          if (upcoming >= MAX_ACTIVE_ONLINE_BOOKINGS_PER_CONTACT) {
            throw new BookingLimitError(
              'BOOKING_CONTACT_LIMIT',
              MAX_ACTIVE_ONLINE_BOOKINGS_PER_CONTACT,
            );
          }
          const booked = Appointment.book(this.ids.generate(), {
            tenantId: settings.tenantId,
            professionalId,
            service,
            contactId,
            startsAt: slot.startsAt,
            source: 'site',
            notes: input.notes,
            createdBy: null,
          });
          await this.appointments.save(booked);
          await this.events.publish(booked.pullEvents());
          return booked;
        });
      } catch (error) {
        // Horário tomado entre o cálculo e a gravação: com "qualquer um",
        // tenta o próximo profissional livre. Limite não: sobe.
        if (error instanceof AppointmentConflictError) continue;
        throw error;
      }
      const professionalName = professionals.find((p) => p.id === professionalId)?.name ?? '';
      return { appointment, professionalName };
    }
    throw new AppointmentConflictError();
  }
}
