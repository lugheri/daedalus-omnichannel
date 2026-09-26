import { UnauthorizedError } from '../../../../shared/domain/domain-error';

/**
 * Mesma mensagem para "e-mail não existe" e "senha errada": responder de
 * forma diferente revelaria quais e-mails estão cadastrados.
 */
export class InvalidCredentialsError extends UnauthorizedError {
  readonly code = 'AUTH_INVALID_CREDENTIALS';

  constructor() {
    super('Invalid email or password');
  }
}
