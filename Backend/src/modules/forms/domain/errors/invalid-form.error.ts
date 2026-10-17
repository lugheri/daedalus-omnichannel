import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidFormCode =
  | 'FORM_INVALID_NAME'
  | 'FORM_INVALID_KIND'
  | 'FORM_INVALID_CAMPAIGN'
  | 'FORM_INVALID_SUCCESS_URL'
  | 'FORM_INACTIVE'
  | 'FORM_INVALID_FIELD'
  | 'FORM_UNKNOWN_SERVICE';

/** Regra do formulário ou do envio violada (422). */
export class InvalidFormError extends DomainError {
  constructor(readonly code: InvalidFormCode) {
    super(`Invalid form: ${code}`);
  }
}
