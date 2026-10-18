import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { Appointment } from '../../domain/appointment.entity';
import type { BookingSettings, BookingSettingsValues } from '../../domain/booking-settings.entity';
import { AppointmentConflictError } from '../../domain/errors/appointment-conflict.error';
import { BookingNotFoundError } from '../../domain/errors/booking-not-found.error';
import { InvalidAppointmentError } from '../../domain/errors/invalid-appointment.error';
import { addDays, isLocalDate, localDateOf } from '../../domain/zoned-time';
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
  ) {}

  async execute(
    changes: Partial<BookingSettingsValues> & { rotateKey?: boolean },
  ): Promise<BookingSettings> {
    const settings = await this.settings.current();
    const { rotateKey, ...values } = changes;
    settings.update(values);
    if (rotateKey) settings.rotateKey(this.keys.generate());
    await this.repository.save(settings);
    return settings;
  }
}

// ── agendamento pelo site (rotas públicas) ─────────────────────────────────

/** A conta pela chave do widget (agendamento online ligado); fixa o tenant. */
@Injectable()
export class ResolveBookingKey {
  constructor(
    @Inject(BOOKING_SETTINGS_REPOSITORY) private readonly settings: BookingSettingsRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(key: string): Promise<BookingSettings> {
    const settings = await this.settings.findByPublicKeyAsSystem(key);
    if (!settings?.enabled) throw new BookingNotFoundError();
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

    const { contactId } = await this.contacts.captureBookingLead({
      name,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    });
    const { professionals } = await this.catalog.load();
    for (const professionalId of slot.professionalIds) {
      const appointment = Appointment.book(this.ids.generate(), {
        tenantId: settings.tenantId,
        professionalId,
        service,
        contactId,
        startsAt: slot.startsAt,
        source: 'site',
        notes: input.notes,
        createdBy: null,
      });
      try {
        await this.unitOfWork.run(async () => {
          await this.appointments.save(appointment);
          await this.events.publish(appointment.pullEvents());
        });
      } catch (error) {
        if (error instanceof AppointmentConflictError) continue;
        throw error;
      }
      const professionalName = professionals.find((p) => p.id === professionalId)?.name ?? '';
      return { appointment, professionalName };
    }
    throw new AppointmentConflictError();
  }
}
