import { ConflictError } from '../../../../shared/domain/domain-error';

export class ChannelNotConnectedError extends ConflictError {
  readonly code = 'CHANNEL_NOT_CONNECTED';

  constructor() {
    super('The channel is not connected');
  }
}
