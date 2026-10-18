import type { WeeklyHours } from '../../domain/weekly-hours';

/** Restrito ao tenant atual. Sem horário gravado, vale o padrão (DEFAULT_WEEKLY_HOURS). */
export interface ScheduleRepository {
  /** Os horários gravados dos profissionais informados. */
  findMany(professionalIds: string[]): Promise<Map<string, WeeklyHours>>;
  save(professionalId: string, weekly: WeeklyHours): Promise<void>;
}

export const SCHEDULE_REPOSITORY = Symbol('ScheduleRepository');
