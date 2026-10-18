import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { InvalidAppointmentError } from '../../domain/errors/invalid-appointment.error';
import { TimeOffNotFoundError } from '../../domain/errors/time-off-not-found.error';
import { newTimeOff, type TimeOff } from '../../domain/time-off';
import {
  DEFAULT_WEEKLY_HOURS,
  validWeeklyHours,
  type TimeRange,
  type WeeklyHours,
} from '../../domain/weekly-hours';
import { SCHEDULE_REPOSITORY, type ScheduleRepository } from '../ports/schedule.repository';
import { SCHEDULING_CATALOG, type SchedulingCatalog } from '../ports/scheduling-sources';
import { TIME_OFF_REPOSITORY, type TimeOffRepository } from '../ports/time-off.repository';

/** Até onde a tela mostra os bloqueios que vêm por aí. */
const UPCOMING_DAYS = 400;

async function assertProfessional(catalog: SchedulingCatalog, id: string): Promise<void> {
  const { professionals } = await catalog.load();
  if (!professionals.some((p) => p.id === id)) {
    throw new InvalidAppointmentError('APPOINTMENT_UNKNOWN_PROFESSIONAL');
  }
}

/** O horário semanal (ou o padrão, se nunca configurado) e os bloqueios futuros. */
@Injectable()
export class GetProfessionalScheduleUseCase {
  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepository,
    @Inject(TIME_OFF_REPOSITORY) private readonly timeOffs: TimeOffRepository,
    @Inject(SCHEDULING_CATALOG) private readonly catalog: SchedulingCatalog,
  ) {}

  async execute(
    professionalId: string,
  ): Promise<{ weekly: WeeklyHours; isDefault: boolean; timeOffs: TimeOff[] }> {
    await assertProfessional(this.catalog, professionalId);
    const saved = (await this.schedules.findMany([professionalId])).get(professionalId);
    const now = new Date();
    const timeOffs = await this.timeOffs.listBetween({
      from: now,
      to: new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60_000),
      professionalIds: [professionalId],
    });
    return { weekly: saved ?? DEFAULT_WEEKLY_HOURS, isDefault: !saved, timeOffs };
  }
}

@Injectable()
export class SetWeeklyHoursUseCase {
  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepository,
    @Inject(SCHEDULING_CATALOG) private readonly catalog: SchedulingCatalog,
  ) {}

  async execute(professionalId: string, weekly: TimeRange[][]): Promise<WeeklyHours> {
    await assertProfessional(this.catalog, professionalId);
    const valid = validWeeklyHours(weekly);
    await this.schedules.save(professionalId, valid);
    return valid;
  }
}

/** Bloqueio novo. Agendamentos que já existem no período continuam (a tela avisa). */
@Injectable()
export class AddTimeOffUseCase {
  constructor(
    @Inject(TIME_OFF_REPOSITORY) private readonly timeOffs: TimeOffRepository,
    @Inject(SCHEDULING_CATALOG) private readonly catalog: SchedulingCatalog,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
  }): Promise<TimeOff> {
    await assertProfessional(this.catalog, input.professionalId);
    const timeOff = newTimeOff(this.ids.generate(), { ...input, tenantId: this.tenant.tenantId });
    await this.timeOffs.save(timeOff);
    return timeOff;
  }
}

@Injectable()
export class RemoveTimeOffUseCase {
  constructor(@Inject(TIME_OFF_REPOSITORY) private readonly timeOffs: TimeOffRepository) {}

  async execute(id: string): Promise<void> {
    const timeOff = await this.timeOffs.findById(id);
    if (!timeOff) throw new TimeOffNotFoundError();
    await this.timeOffs.delete(timeOff);
  }
}
