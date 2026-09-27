import { ConflictError } from '../../../../shared/domain/domain-error';

export class LastOwnerError extends ConflictError {
  readonly code = 'ACCOUNT_LAST_OWNER';

  constructor() {
    super('The account must keep at least one active Owner');
  }
}
