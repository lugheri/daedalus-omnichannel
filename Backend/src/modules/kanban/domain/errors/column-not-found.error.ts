import { NotFoundError } from '../../../../shared/domain/domain-error';

export class ColumnNotFoundError extends NotFoundError {
  readonly code = 'BOARD_COLUMN_NOT_FOUND';

  constructor() {
    super('Column not found in this board');
  }
}
