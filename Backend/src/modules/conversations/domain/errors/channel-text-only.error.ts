import { DomainError } from '../../../../shared/domain/domain-error';

/** O chat do site (por enquanto) só troca texto: sem anexos (422). */
export class ChannelTextOnlyError extends DomainError {
  readonly code = 'CONVERSATION_CHANNEL_TEXT_ONLY';

  constructor() {
    super('This channel only sends text');
  }
}
