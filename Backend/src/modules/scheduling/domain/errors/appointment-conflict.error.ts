import { ConflictError } from '../../../../shared/domain/domain-error';

/** O horário cruza outro agendamento do mesmo profissional (ou acabou de ser ocupado): 409. */
export class AppointmentConflictError extends ConflictError {
  readonly code = 'APPOINTMENT_SLOT_TAKEN';

  constructor() {
    super('This time slot is taken');
  }
}
