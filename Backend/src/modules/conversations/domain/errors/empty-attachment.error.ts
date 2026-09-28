import { DomainError } from '../../../../shared/domain/domain-error';

export class EmptyAttachmentError extends DomainError {
  readonly code = 'ATTACHMENT_EMPTY';

  constructor() {
    super('The attached file is empty');
  }
}
