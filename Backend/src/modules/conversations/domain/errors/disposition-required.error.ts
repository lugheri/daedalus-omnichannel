import { DomainError } from '../../../../shared/domain/domain-error';

/** A conta tem tabulações: o atendimento só é resolvido com uma. */
export class DispositionRequiredError extends DomainError {
  readonly code = 'CONVERSATION_DISPOSITION_REQUIRED';

  constructor() {
    super('Choose a disposition to resolve the conversation');
  }
}
