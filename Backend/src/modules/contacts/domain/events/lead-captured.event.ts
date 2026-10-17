import { DomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Chegou um lead pelo formulário do site — contato novo ou já existente
 * (cada envio é uma nova oportunidade). Os funis que recebem leads abrem um
 * negócio, se o contato ainda não tiver um em aberto lá.
 */
export class LeadCapturedEvent extends DomainEvent {
  static readonly eventName = 'contact.lead-captured.v1';
  readonly eventName = LeadCapturedEvent.eventName;

  constructor(
    contactId: string,
    readonly tenantId: string,
    /** Campanha / página do formulário, se veio. */
    readonly campaign: string | null,
    /** O contato acabou de ser criado por este envio? */
    readonly newContact: boolean,
  ) {
    super(contactId);
  }
}
