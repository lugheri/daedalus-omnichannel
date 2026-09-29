import { ConflictError } from '../../../../shared/domain/domain-error';

export class DispositionNameTakenError extends ConflictError {
  readonly code = 'DISPOSITION_NAME_TAKEN';

  constructor() {
    super('There is already a disposition with this name');
  }
}
