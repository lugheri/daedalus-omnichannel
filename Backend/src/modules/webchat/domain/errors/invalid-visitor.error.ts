import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidVisitorCode =
  | 'WEB_CHAT_INVALID_NAME'
  /** Telefone ou e-mail: pelo menos um, para a empresa poder responder depois. */
  | 'WEB_CHAT_CONTACT_REQUIRED'
  | 'WEB_CHAT_INVALID_MESSAGE';

/** Dado do visitante fora da regra (422). */
export class InvalidVisitorError extends DomainError {
  constructor(readonly code: InvalidVisitorCode) {
    super(`Invalid visitor input: ${code}`);
  }
}
