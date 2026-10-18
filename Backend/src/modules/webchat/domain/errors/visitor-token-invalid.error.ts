import { UnauthorizedError } from '../../../../shared/domain/domain-error';

/** Token do visitante ausente, adulterado ou vencido (401): o widget pede os dados de novo. */
export class VisitorTokenInvalidError extends UnauthorizedError {
  readonly code = 'WEB_CHAT_INVALID_TOKEN';

  constructor() {
    super('Invalid visitor token');
  }
}
