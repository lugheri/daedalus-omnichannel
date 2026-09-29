import { ConflictError } from '../../../../shared/domain/domain-error';

export class BoardNameTakenError extends ConflictError {
  readonly code = 'BOARD_NAME_TAKEN';

  constructor() {
    super('There is already a board with this name');
  }
}
