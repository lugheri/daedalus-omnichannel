import { NotFoundError } from '../../../../shared/domain/domain-error';

/**
 * Usuário inexistente. Só para operação interna (o comando `reset-password`):
 * rotas públicas nunca revelam se um e-mail existe (`InvalidCredentialsError`).
 */
export class UserNotFoundError extends NotFoundError {
  readonly code = 'USER_NOT_FOUND';

  constructor() {
    super('User not found');
  }
}
