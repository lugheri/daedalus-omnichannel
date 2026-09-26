import { DomainError } from '../../../../shared/domain/domain-error';

export class ContactWithoutIdentifierError extends DomainError {
  readonly code = 'CONTACT_WITHOUT_IDENTIFIER';

  constructor() {
    super('A contact needs at least a phone or an email');
  }
}
