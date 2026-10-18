import { Inject, Injectable } from '@nestjs/common';
import { freeSlots, type Busy } from '../domain/availability';
import type { BookingSettingsValues } from '../domain/booking-settings.entity';
import { InvalidAppointmentError } from '../domain/errors/invalid-appointment.error';
import { DEFAULT_WEEKLY_HOURS } from '../domain/weekly-hours';
import { addDays, weekdayOf, zonedToUtc } from '../domain/zoned-time';
import { APPOINTMENT_REPOSITORY, type AppointmentRepository } from './ports/appointment.repository';
import { SCHEDULE_REPOSITORY, type ScheduleRepository } from './ports/schedule.repository';
import {
  SCHEDULING_CATALOG,
  type AgendaProfessional,
  type AgendaService,
  type SchedulingCatalog,
} from './ports/scheduling-sources';
import { TIME_OFF_REPOSITORY, type TimeOffRepository } from './ports/time-off.repository';

export interface FreeSlot {
  startsAt: Date;
  /** Quem está livre nesse horário (por nome do catálogo). */
  professionalIds: string[];
}

/**
 * Horários livres de um serviço num dia: o horário semanal de cada
 * profissional que faz o serviço (sem horário gravado, o padrão), menos os
 * agendamentos ativos e os bloqueios. Mesma conta para o painel e o site — o
 * site só vê serviços e profissionais marcados "mostrar no site".
 */
@Injectable()
export class Availability {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepository,
    @Inject(TIME_OFF_REPOSITORY) private readonly timeOffs: TimeOffRepository,
    @Inject(SCHEDULING_CATALOG) private readonly catalog: SchedulingCatalog,
  ) {}

  async slots(input: {
    settings: BookingSettingsValues;
    serviceId: string;
    professionalId: string | null;
    date: string;
    notBefore: Date;
    publicOnly: boolean;
  }): Promise<{ service: AgendaService; slots: FreeSlot[] }> {
    const { services, professionals } = await this.catalog.load();
    const service = services.find(
      (s) => s.id === input.serviceId && s.active && (!input.publicOnly || s.showOnSite),
    );
    if (!service) throw new InvalidAppointmentError('APPOINTMENT_UNKNOWN_SERVICE');
    const candidates = bookableFor(service, professionals, input.publicOnly).filter(
      (p) => !input.professionalId || p.id === input.professionalId,
    );
    if (candidates.length === 0) return { service, slots: [] };

    const tz = input.settings.timezone;
    const from = zonedToUtc(input.date, 0, tz);
    const to = zonedToUtc(addDays(input.date, 1), 0, tz);
    const ids = candidates.map((p) => p.id);
    const [appointments, offs, weekly] = await Promise.all([
      this.appointments.listBetween({ from, to, professionalIds: ids, statuses: ['scheduled'] }),
      this.timeOffs.listBetween({ from, to, professionalIds: ids }),
      this.schedules.findMany(ids),
    ]);
    const weekday = weekdayOf(input.date);

    const byStart = new Map<number, string[]>();
    for (const professional of candidates) {
      const busy: Busy[] = [
        ...appointments
          .filter((a) => a.professionalId === professional.id)
          .map((a) => ({ start: a.startsAt, end: a.endsAt })),
        ...offs
          .filter((o) => o.professionalId === professional.id)
          .map((o) => ({ start: o.startsAt, end: o.endsAt })),
      ];
      const slots = freeSlots({
        date: input.date,
        timeZone: tz,
        ranges: (weekly.get(professional.id) ?? DEFAULT_WEEKLY_HOURS)[weekday],
        busy,
        durationMinutes: service.durationMinutes,
        stepMinutes: input.settings.slotStepMinutes,
        notBefore: input.notBefore,
      });
      for (const slot of slots) {
        byStart.set(slot.getTime(), [...(byStart.get(slot.getTime()) ?? []), professional.id]);
      }
    }
    return {
      service,
      slots: [...byStart.entries()]
        .sort(([a], [b]) => a - b)
        .map(([time, professionalIds]) => ({ startsAt: new Date(time), professionalIds })),
    };
  }
}

/** Profissionais ativos que fazem o serviço (no site, só os marcados para aparecer). */
export function bookableFor(
  service: AgendaService,
  professionals: AgendaProfessional[],
  publicOnly: boolean,
): AgendaProfessional[] {
  return professionals.filter(
    (p) => p.active && (!publicOnly || p.showOnSite) && p.offeringIds.includes(service.id),
  );
}
