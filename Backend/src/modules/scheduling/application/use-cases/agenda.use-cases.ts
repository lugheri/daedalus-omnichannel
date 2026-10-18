import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { Appointment, type AppointmentStatus } from '../../domain/appointment.entity';
import { AppointmentNotFoundError } from '../../domain/errors/appointment-not-found.error';
import { InvalidAppointmentError } from '../../domain/errors/invalid-appointment.error';
import type { TimeOff } from '../../domain/time-off';
import { DEFAULT_WEEKLY_HOURS, type TimeRange } from '../../domain/weekly-hours';
import { addDays, isLocalDate, weekdayOf, zonedToUtc } from '../../domain/zoned-time';
import { AgendaSettings } from '../agenda-settings';
import { Availability, type FreeSlot } from '../availability';
import {
  APPOINTMENT_REPOSITORY,
  type AppointmentRepository,
} from '../ports/appointment.repository';
import { SCHEDULE_REPOSITORY, type ScheduleRepository } from '../ports/schedule.repository';
import {
  SCHEDULING_CATALOG,
  SCHEDULING_CONTACTS,
  SCHEDULING_MEMBERS,
  type AgendaProfessional,
  type AgendaService,
  type SchedulingCatalog,
  type SchedulingContacts,
  type SchedulingMembers,
} from '../ports/scheduling-sources';
import { TIME_OFF_REPOSITORY, type TimeOffRepository } from '../ports/time-off.repository';

function assertDate(date: string): void {
  if (!isLocalDate(date)) throw new InvalidAppointmentError('APPOINTMENT_INVALID_TIME');
}

async function load(appointments: AppointmentRepository, id: string): Promise<Appointment> {
  const appointment = await appointments.findById(id);
  if (!appointment) throw new AppointmentNotFoundError();
  return appointment;
}

export interface AgendaDay {
  date: string;
  timezone: string;
  /** Ativos, mais os inativos que têm algo no dia. */
  professionals: (AgendaProfessional & { hours: TimeRange[] })[];
  services: AgendaService[];
  appointments: Appointment[];
  timeOffs: TimeOff[];
  contacts: Map<string, { name: string | null; phone: string | null }>;
}

/** O dia na agenda: os profissionais com o horário do dia, os agendamentos e os bloqueios. */
@Injectable()
export class ListAgendaDayUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepository,
    @Inject(TIME_OFF_REPOSITORY) private readonly timeOffs: TimeOffRepository,
    @Inject(SCHEDULING_CATALOG) private readonly catalog: SchedulingCatalog,
    @Inject(SCHEDULING_CONTACTS) private readonly contacts: SchedulingContacts,
    private readonly settings: AgendaSettings,
  ) {}

  async execute(date: string): Promise<AgendaDay> {
    assertDate(date);
    const { timezone } = await this.settings.current();
    const from = zonedToUtc(date, 0, timezone);
    const to = zonedToUtc(addDays(date, 1), 0, timezone);
    const [{ services, professionals }, appointments, timeOffs] = await Promise.all([
      this.catalog.load(),
      this.appointments.listBetween({ from, to }),
      this.timeOffs.listBetween({ from, to }),
    ]);
    const busyIds = new Set([...appointments, ...timeOffs].map((x) => x.professionalId));
    const shown = professionals.filter((p) => p.active || busyIds.has(p.id));
    const weekly = await this.schedules.findMany(shown.map((p) => p.id));
    const weekday = weekdayOf(date);
    const contacts = await this.contacts.findByIds([
      ...new Set(appointments.map((a) => a.contactId)),
    ]);
    return {
      date,
      timezone,
      professionals: shown.map((p) => ({
        ...p,
        hours: (weekly.get(p.id) ?? DEFAULT_WEEKLY_HOURS)[weekday],
      })),
      services,
      appointments,
      timeOffs,
      contacts: new Map(contacts.map((c) => [c.id, { name: c.name, phone: c.phone }])),
    };
  }
}

/** Sugestões de horário livre para marcar pelo painel (a partir de agora). */
@Injectable()
export class AgendaFreeSlotsUseCase {
  constructor(
    private readonly availability: Availability,
    private readonly settings: AgendaSettings,
  ) {}

  async execute(input: {
    serviceId: string;
    professionalId: string | null;
    date: string;
  }): Promise<FreeSlot[]> {
    assertDate(input.date);
    const settings = await this.settings.current();
    const { slots } = await this.availability.slots({
      settings: settings.values,
      ...input,
      notBefore: new Date(),
      publicOnly: false,
    });
    return slots;
  }
}

/** Valida que o profissional (ativo) faz o serviço (ativo). */
async function serviceFor(
  catalog: SchedulingCatalog,
  input: { serviceId: string; professionalId: string },
): Promise<AgendaService> {
  const { services, professionals } = await catalog.load();
  const service = services.find((s) => s.id === input.serviceId && s.active);
  if (!service) throw new InvalidAppointmentError('APPOINTMENT_UNKNOWN_SERVICE');
  const professional = professionals.find((p) => p.id === input.professionalId && p.active);
  if (!professional) throw new InvalidAppointmentError('APPOINTMENT_UNKNOWN_PROFESSIONAL');
  if (!professional.offeringIds.includes(service.id)) {
    throw new InvalidAppointmentError('APPOINTMENT_SERVICE_NOT_OFFERED');
  }
  return service;
}

/**
 * Marcar pelo painel. Pode ser fora do horário semanal (encaixe): a equipe
 * sabe o que faz. Não pode cruzar outro agendamento ativo do profissional.
 */
@Injectable()
export class BookAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(SCHEDULING_CATALOG) private readonly catalog: SchedulingCatalog,
    @Inject(SCHEDULING_CONTACTS) private readonly contacts: SchedulingContacts,
    @Inject(SCHEDULING_MEMBERS) private readonly members: SchedulingMembers,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: {
    professionalId: string;
    serviceId: string;
    contactId: string;
    startsAt: Date;
    notes: string | null;
  }): Promise<Appointment> {
    const service = await serviceFor(this.catalog, input);
    const [contact] = await this.contacts.findByIds([input.contactId]);
    if (!contact) throw new InvalidAppointmentError('APPOINTMENT_UNKNOWN_CONTACT');
    const appointment = Appointment.book(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      professionalId: input.professionalId,
      service,
      contactId: contact.id,
      startsAt: input.startsAt,
      source: 'panel',
      notes: input.notes,
      createdBy: await this.members.currentMembershipId(),
    });
    await this.unitOfWork.run(async () => {
      await this.appointments.save(appointment);
      await this.events.publish(appointment.pullEvents());
    });
    return appointment;
  }
}

/** Remarcar (horário e/ou profissional) e anotações. */
@Injectable()
export class UpdateAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(SCHEDULING_CATALOG) private readonly catalog: SchedulingCatalog,
  ) {}

  async execute(
    id: string,
    changes: { startsAt?: Date; professionalId?: string; notes?: string | null },
  ): Promise<Appointment> {
    const appointment = await load(this.appointments, id);
    if (changes.professionalId && changes.professionalId !== appointment.professionalId) {
      await serviceFor(this.catalog, {
        serviceId: appointment.serviceId,
        professionalId: changes.professionalId,
      });
    }
    if (changes.startsAt || changes.professionalId) {
      appointment.reschedule({
        startsAt: changes.startsAt,
        professionalId: changes.professionalId,
      });
    }
    if (changes.notes !== undefined) appointment.editNotes(changes.notes);
    await this.appointments.save(appointment);
    return appointment;
  }
}

/** Concluído, faltou, cancelado (com motivo) — ou desfazer (volta a marcado). */
@Injectable()
export class ChangeAppointmentStatusUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
  ) {}

  async execute(
    id: string,
    status: AppointmentStatus,
    reason: string | null,
  ): Promise<Appointment> {
    const appointment = await load(this.appointments, id);
    appointment.changeStatus(status, reason);
    await this.appointments.save(appointment);
    return appointment;
  }
}

/** Agendamentos de um contato (ficha), mais recentes primeiro. */
@Injectable()
export class ContactAppointmentsUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
  ) {}

  execute(contactId: string): Promise<Appointment[]> {
    return this.appointments.listByContact(contactId, 50);
  }
}
