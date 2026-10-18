import { NotFoundError } from '../../../../shared/domain/domain-error';

/** Chave do widget desconhecida (ou o canal não é chat do site): 404. */
export class WebChatNotFoundError extends NotFoundError {
  readonly code = 'WEB_CHAT_NOT_FOUND';

  constructor() {
    super('Web chat not found');
  }
}
