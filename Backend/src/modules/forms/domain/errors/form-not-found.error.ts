import { NotFoundError } from '../../../../shared/domain/domain-error';

/** Formulário inexistente, de outra conta ou com chave trocada. */
export class FormNotFoundError extends NotFoundError {
  readonly code = 'FORM_NOT_FOUND';

  constructor() {
    super('Form not found');
  }
}
