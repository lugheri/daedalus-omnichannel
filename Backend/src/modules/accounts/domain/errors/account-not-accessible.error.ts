import { ForbiddenError } from '../../../../shared/domain/domain-error';

/**
 * Troca de conta para uma conta em que a pessoa não pode entrar (sem vínculo
 * ativo, vínculo desativado ou conta suspensa). 403 e não 401: a sessão atual
 * continua válida — só a troca é recusada.
 */
export class AccountNotAccessibleError extends ForbiddenError {
  readonly code = 'ACCOUNT_NOT_ACCESSIBLE';

  constructor() {
    super('No active access to this account');
  }
}
