import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidAppointmentCode =
  | 'APPOINTMENT_INVALID_TIME'
  | 'APPOINTMENT_INVALID_NOTES'
  | 'APPOINTMENT_INVALID_STATUS'
  | 'APPOINTMENT_UNKNOWN_SERVICE'
  | 'APPOINTMENT_UNKNOWN_PROFESSIONAL'
  | 'APPOINTMENT_UNKNOWN_CONTACT'
  /** Pelo site: nome e telefone ou e-mail, para a empresa falar com a pessoa. */
  | 'APPOINTMENT_CONTACT_REQUIRED'
  /** O profissional não faz esse serviço. */
  | 'APPOINTMENT_SERVICE_NOT_OFFERED';

/** Agendamento fora da regra (422). */
export class InvalidAppointmentError extends DomainError {
  constructor(readonly code: InvalidAppointmentCode) {
    super(`Invalid appointment: ${code}`);
  }
}
