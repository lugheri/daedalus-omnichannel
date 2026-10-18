import { DomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Horário marcado (pelo painel ou pelo site). Os funis abrem o negócio para
 * os marcados pelo site ("Corte — Ana", com o preço do serviço).
 */
export class AppointmentBookedEvent extends DomainEvent {
  static readonly eventName = 'appointment.booked.v1';
  readonly eventName = AppointmentBookedEvent.eventName;

  constructor(
    appointmentId: string,
    readonly tenantId: string,
    readonly contactId: string,
    readonly professionalId: string,
    readonly service: { id: string; name: string; priceCents: number | null },
    readonly startsAt: string,
    readonly source: 'panel' | 'site',
  ) {
    super(appointmentId);
  }
}
