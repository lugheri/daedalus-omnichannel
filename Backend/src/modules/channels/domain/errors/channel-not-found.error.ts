import { NotFoundError } from '../../../../shared/domain/domain-error';

export class ChannelNotFoundError extends NotFoundError {
  readonly code = 'CHANNEL_NOT_FOUND';

  constructor() {
    super('Channel not found');
  }
}
