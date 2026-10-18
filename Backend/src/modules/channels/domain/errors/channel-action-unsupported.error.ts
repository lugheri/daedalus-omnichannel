import { DomainError } from '../../../../shared/domain/domain-error';

export type ChannelActionUnsupportedCode =
  /** Só o WhatsApp tem QR code, mensagem de teste e anexos. */
  | 'CHANNEL_NOT_WHATSAPP'
  /** Configuração e mensagens do visitante: só no chat do site. */
  | 'CHANNEL_NOT_WEB_CHAT';

/** A ação não existe para o tipo deste canal (422). */
export class ChannelActionUnsupportedError extends DomainError {
  constructor(readonly code: ChannelActionUnsupportedCode) {
    super(`Unsupported for this channel type: ${code}`);
  }
}
