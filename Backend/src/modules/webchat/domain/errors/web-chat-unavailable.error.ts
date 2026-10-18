import { ConflictError } from '../../../../shared/domain/domain-error';

/** O chat do site está desligado (409): o widget avisa e some. */
export class WebChatUnavailableError extends ConflictError {
  readonly code = 'WEB_CHAT_UNAVAILABLE';

  constructor() {
    super('Web chat is turned off');
  }
}
