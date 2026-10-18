import { InvalidScheduleError } from './errors/invalid-schedule.error';

/** Um bloqueio não passa de um ano (férias longas: vários). */
const MAX_DAYS = 366;

/** Folga, férias, compromisso: o profissional não atende nesse período. */
export interface TimeOff {
  id: string;
  tenantId: string;
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
  createdAt: Date;
}

export function newTimeOff(
  id: string,
  input: {
    tenantId: string;
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
  },
): TimeOff {
  const length = input.endsAt.getTime() - input.startsAt.getTime();
  if (
    Number.isNaN(length) ||
    length <= 0 ||
    length > MAX_DAYS * 24 * 60 * 60_000 ||
    (input.reason?.length ?? 0) > 200
  ) {
    throw new InvalidScheduleError('AGENDA_INVALID_TIME_OFF');
  }
  return {
    id,
    tenantId: input.tenantId,
    professionalId: input.professionalId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    reason: input.reason?.trim() || null,
    createdAt: new Date(),
  };
}
