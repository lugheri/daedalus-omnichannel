import { NotFoundError } from '../../../../shared/domain/domain-error';

export class AppointmentNotFoundError extends NotFoundError {
  readonly code = 'APPOINTMENT_NOT_FOUND';

  constructor() {
    super('Appointment not found');
  }
}
