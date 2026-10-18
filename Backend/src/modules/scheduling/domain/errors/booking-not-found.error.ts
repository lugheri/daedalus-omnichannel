import { NotFoundError } from '../../../../shared/domain/domain-error';

/** Chave do agendamento online desconhecida ou agendamento online desligado (404). */
export class BookingNotFoundError extends NotFoundError {
  readonly code = 'BOOKING_NOT_FOUND';

  constructor() {
    super('Online booking not found');
  }
}
