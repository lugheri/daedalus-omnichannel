import { DomainError } from '../../../../shared/domain/domain-error';

export class ChannelTeamNotFoundError extends DomainError {
  readonly code = 'CHANNEL_TEAM_NOT_FOUND';

  constructor() {
    super('Team not found');
  }
}
