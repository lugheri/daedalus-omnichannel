import { UnauthorizedError } from '../../../../shared/domain/domain-error';

/** Mesma resposta para chave inexistente, revogada ou com segredo errado. */
export class InvalidApiKeyError extends UnauthorizedError {
  readonly code = 'API_KEY_INVALID';

  constructor() {
    super('Invalid or revoked API key');
  }
}
