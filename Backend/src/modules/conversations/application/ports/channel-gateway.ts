/**
 * O que conversations precisa do módulo channels, nos termos de conversations.
 * Adapter em infra/ sobre a ChannelsFacade.
 */
export interface ChannelInfo {
  id: string;
  name: string;
  /** Equipe que recebe as conversas novas do canal. */
  teamId: string | null;
}

export interface ChannelGateway {
  findByIds(ids: string[]): Promise<ChannelInfo[]>;
  /** Lança erro de domínio do channels (404 ou 409 "não conectado"). */
  assertCanSend(channelId: string): Promise<void>;
  /** Enfileira o envio; o resultado chega depois, por evento, com o mesmo `messageId`. */
  sendText(input: {
    channelId: string;
    messageId: string;
    to: string;
    text: string;
  }): Promise<void>;
}

export const CHANNEL_GATEWAY = Symbol('ChannelGateway');
