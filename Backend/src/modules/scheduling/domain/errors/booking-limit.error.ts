import { DomainError } from '../../../../shared/domain/domain-error';

export type BookingLimitCode =
  /** O contato já tem o máximo de agendamentos futuros marcados pelo site. */
  | 'BOOKING_CONTACT_LIMIT'
  /** A conta já recebeu o máximo de agendamentos pelo site hoje. */
  | 'BOOKING_DAILY_LIMIT';

/**
 * Agendamento pelo site recusado por limite (422; ver `booking-limits.ts`).
 * O widget mostra a mensagem pelo código e sugere falar com a empresa.
 */
export class BookingLimitError extends DomainError {
  constructor(
    readonly code: BookingLimitCode,
    readonly limit: number,
  ) {
    super(`Online booking limit reached: ${code} (${limit})`);
  }
}
