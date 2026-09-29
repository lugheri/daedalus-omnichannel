import { ConflictError } from '../../../../shared/domain/domain-error';

/** Coluna com cards: diga para qual coluna eles vão antes de excluir. */
export class ColumnNotEmptyError extends ConflictError {
  readonly code = 'BOARD_COLUMN_NOT_EMPTY';

  constructor() {
    super('The column has cards; choose where to move them');
  }
}
