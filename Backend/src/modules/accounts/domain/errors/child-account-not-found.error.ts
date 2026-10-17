import { NotFoundError } from '../../../../shared/domain/domain-error';

/** Conta inexistente ou que não está abaixo da conta atual. */
export class ChildAccountNotFoundError extends NotFoundError {
  readonly code = 'CHILD_ACCOUNT_NOT_FOUND';

  constructor() {
    super('Child account not found');
  }
}
