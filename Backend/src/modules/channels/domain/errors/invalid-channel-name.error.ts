import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidChannelNameError extends DomainError {
  readonly code = 'CHANNEL_INVALID_NAME';

  constructor() {
    super('Channel name must have between 1 and 60 characters');
  }
}
