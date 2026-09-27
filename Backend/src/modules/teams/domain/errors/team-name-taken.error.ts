import { ConflictError } from '../../../../shared/domain/domain-error';

export class TeamNameTakenError extends ConflictError {
  readonly code = 'TEAM_NAME_TAKEN';

  constructor() {
    super('There is already a team with this name');
  }
}
