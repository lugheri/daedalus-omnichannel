import { NotFoundError } from '../../../../shared/domain/domain-error';

export class TeamNotFoundError extends NotFoundError {
  readonly code = 'TEAM_NOT_FOUND';

  constructor() {
    super('Team not found');
  }
}
