import { UnauthorizedError } from '../../../../shared/domain/domain-error';

/** Token malformado, desconhecido, expirado, revogado ou reutilizado. */
export class InvalidRefreshTokenError extends UnauthorizedError {
  readonly code = 'AUTH_INVALID_REFRESH_TOKEN';

  constructor() {
    super('Invalid or expired refresh token');
  }
}
