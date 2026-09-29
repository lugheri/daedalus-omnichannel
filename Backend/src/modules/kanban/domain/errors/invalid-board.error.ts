import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidBoardCode =
  | 'BOARD_INVALID_NAME'
  | 'BOARD_INVALID_COLUMN_NAME'
  | 'BOARD_TOO_MANY_COLUMNS'
  | 'BOARD_NEEDS_COLUMN'
  | 'BOARD_INVALID_AUTO_ADD';

const MESSAGES: Record<InvalidBoardCode, string> = {
  BOARD_INVALID_NAME: 'Board name must have 1 to 60 characters',
  BOARD_INVALID_COLUMN_NAME: 'Column name must have 1 to 40 characters',
  BOARD_TOO_MANY_COLUMNS: 'A board has at most 20 columns',
  BOARD_NEEDS_COLUMN: 'A board needs at least one column',
  BOARD_INVALID_AUTO_ADD: 'Automatic entry by team needs a team',
};

/** Regra de formato do quadro violada (422). */
export class InvalidBoardError extends DomainError {
  constructor(readonly code: InvalidBoardCode) {
    super(MESSAGES[code]);
  }
}
