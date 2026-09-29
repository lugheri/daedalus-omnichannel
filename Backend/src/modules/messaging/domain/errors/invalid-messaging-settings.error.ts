import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidMessagingSettingsCode =
  | 'MESSAGING_INVALID_PROVIDER'
  | 'MESSAGING_INVALID_FROM_EMAIL'
  | 'MESSAGING_INVALID_FROM_NAME'
  | 'MESSAGING_INVALID_REPLY_TO'
  | 'MESSAGING_INVALID_ACCOUNT_SID'
  | 'MESSAGING_INVALID_SENDER'
  | 'MESSAGING_INVALID_SECRET'
  | 'MESSAGING_SECRET_REQUIRED'
  | 'MESSAGING_INVALID_RECIPIENT'
  | 'MESSAGING_INVALID_WEBHOOK_KEY';

/** Configuração de provedor inválida (422). */
export class InvalidMessagingSettingsError extends DomainError {
  constructor(readonly code: InvalidMessagingSettingsCode) {
    super(`Invalid messaging settings: ${code}`);
  }
}
