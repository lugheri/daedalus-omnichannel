import { DomainError } from '../../../../shared/domain/domain-error';

/** O contato não tem e-mail (ou telefone, para SMS). */
export class ContactWithoutAddressError extends DomainError {
  readonly code = 'MESSAGING_CONTACT_WITHOUT_ADDRESS';

  constructor() {
    super('The contact has no address for this channel');
  }
}
