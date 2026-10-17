import { DomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Alguém enviou um formulário do site. Os funis que recebem leads abrem um
 * negócio (título com o serviço, valor = preço dele), se o contato ainda não
 * tiver um em aberto lá.
 */
export class FormSubmittedEvent extends DomainEvent {
  static readonly eventName = 'form.submitted.v1';
  readonly eventName = FormSubmittedEvent.eventName;

  constructor(
    submissionId: string,
    readonly tenantId: string,
    readonly formId: string,
    readonly kind: 'contact' | 'service',
    readonly contactId: string,
    /** Solicitação de serviço: o serviço escolhido (nome e preço no momento). */
    readonly service: { id: string; name: string; priceCents: number | null } | null,
  ) {
    super(submissionId);
  }
}
