import { ForbiddenError } from '../../../../shared/domain/domain-error';

/** Esta conta não é revendedora: não cria contas abaixo (quem libera é a conta de cima). */
export class ChildrenNotAllowedError extends ForbiddenError {
  readonly code = 'CHILD_ACCOUNTS_NOT_ALLOWED';

  constructor() {
    super('This account cannot create child accounts');
  }
}
