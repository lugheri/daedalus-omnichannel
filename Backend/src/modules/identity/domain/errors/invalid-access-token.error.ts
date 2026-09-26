import { UnauthorizedError } from '../../../../shared/domain/domain-error';

/** Ausente, malformado, com assinatura inválida ou expirado — o cliente deve fazer refresh. */
export class InvalidAccessTokenError extends UnauthorizedError {
  readonly code = 'AUTH_INVALID_ACCESS_TOKEN';

  constructor() {
    super('Missing, invalid or expired access token');
  }
}
