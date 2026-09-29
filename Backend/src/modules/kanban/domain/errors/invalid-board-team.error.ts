import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidBoardTeamError extends DomainError {
  readonly code = 'BOARD_INVALID_TEAM';

  constructor() {
    super('Team not found');
  }
}
