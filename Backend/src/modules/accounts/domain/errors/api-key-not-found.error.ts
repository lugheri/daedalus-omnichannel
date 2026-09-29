import { NotFoundError } from '../../../../shared/domain/domain-error';

export class ApiKeyNotFoundError extends NotFoundError {
  readonly code = 'API_KEY_NOT_FOUND';

  constructor() {
    super('API key not found');
  }
}
