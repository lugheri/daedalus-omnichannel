import { ConflictError } from '../../../../shared/domain/domain-error';

export class ChannelStillActiveError extends ConflictError {
  readonly code = 'CHANNEL_STILL_ACTIVE';

  constructor() {
    super('Disconnect the channel before removing it');
  }
}
