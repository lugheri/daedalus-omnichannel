import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidWebChatSettingsCode =
  'CHANNEL_INVALID_CHAT_TITLE' | 'CHANNEL_INVALID_CHAT_GREETING' | 'CHANNEL_INVALID_CHAT_COLOR';

/** Título, saudação ou cor do chat do site fora da regra (422). */
export class InvalidWebChatSettingsError extends DomainError {
  constructor(readonly code: InvalidWebChatSettingsCode) {
    super(`Invalid web chat settings: ${code}`);
  }
}
