import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidOutboundMessageError extends DomainError {
  constructor(readonly code: 'MESSAGING_INVALID_SUBJECT' | 'MESSAGING_INVALID_BODY') {
    super(`Invalid message: ${code}`);
  }
}
