import { ConflictError } from '../../../../shared/domain/domain-error';

/** O contato pediu para não receber mais por este canal. */
export class OptedOutError extends ConflictError {
  readonly code = 'MESSAGING_OPTED_OUT';

  constructor() {
    super('The contact opted out of this channel');
  }
}
