import { DomainError } from '../../../../shared/domain/domain-error';

/** A conta não configurou o provedor deste canal (e-mail ou SMS). */
export class MessagingNotConfiguredError extends DomainError {
  readonly code = 'MESSAGING_NOT_CONFIGURED';

  constructor() {
    super('No provider configured for this channel');
  }
}
