import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidScheduleCode =
  'AGENDA_INVALID_HOURS' | 'AGENDA_INVALID_TIME_OFF' | 'AGENDA_INVALID_SETTINGS';

/** Horário semanal, bloqueio ou configuração da agenda fora da regra (422). */
export class InvalidScheduleError extends DomainError {
  constructor(readonly code: InvalidScheduleCode) {
    super(`Invalid schedule: ${code}`);
  }
}
