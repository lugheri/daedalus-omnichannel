import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidApiKeyNameError extends DomainError {
  readonly code = 'API_KEY_INVALID_NAME';

  constructor() {
    super('API key name must have between 1 and 60 characters');
  }
}
