import { UnauthorizedError } from '../../../../shared/domain/domain-error';

/**
 * Credenciais válidas, mas sem vínculo ativo com a conta pedida (ou com
 * nenhuma conta). Mesma resposta nos dois casos, para não revelar quais
 * contas existem.
 */
export class AccountAccessDeniedError extends UnauthorizedError {
  readonly code = 'AUTH_ACCOUNT_ACCESS_DENIED';

  constructor() {
    super('No active access to this account');
  }
}
