import { ConflictError } from '../../../../shared/domain/domain-error';

export class ColumnNameTakenError extends ConflictError {
  readonly code = 'BOARD_COLUMN_NAME_TAKEN';

  constructor() {
    super('There is already a column with this name in the board');
  }
}
