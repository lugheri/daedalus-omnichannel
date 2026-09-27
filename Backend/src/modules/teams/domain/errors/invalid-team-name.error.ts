import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidTeamNameError extends DomainError {
  readonly code = 'TEAM_INVALID_NAME';

  constructor() {
    super('Team name must have between 1 and 60 characters');
  }
}
