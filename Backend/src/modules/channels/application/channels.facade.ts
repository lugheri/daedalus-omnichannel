import { Inject, Injectable } from '@nestjs/common';
import type { StoredMedia } from '../../../contracts/whatsapp-connector.contract';
import type {
  Channel,
  ChannelProvider,
  ChannelStatus,
  WebChatSettings,
} from '../domain/channel.entity';
import { ChannelNotFoundError } from '../domain/errors/channel-not-found.error';
import { ChannelSender } from './channel-sender';
import { CHANNEL_REPOSITORY, type ChannelRepository } from './ports/channel.repository';
import { ReceiveWebChatMessageUseCase } from './use-cases/web-chat.use-cases';

/** Dados de canal expostos a outros módulos (objeto simples, nunca a entidade). */
export interface ChannelSummary {
  id: string;
  name: string;
  provider: ChannelProvider;
  status: ChannelStatus;
  /** Equipe que recebe as conversas novas; null = fila geral. */
  teamId: string | null;
}

/** Chat do site, como o widget e o módulo de sites o enxergam. */
export interface WebChatChannel {
  channelId: string;
  tenantId: string;
  name: string;
  publicKey: string;
  settings: WebChatSettings;
  /** Desligado: o widget não aparece e não recebe mensagens. */
  active: boolean;
}

/**
 * API síncrona do módulo para outros módulos (ex.: conversations enviando
 * uma resposta). Exportada pelo `index.ts`.
 */
@Injectable()
export class ChannelsFacade {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    private readonly sender: ChannelSender,
    private readonly receiveWebChat: ReceiveWebChatMessageUseCase,
  ) {}

  /**
   * Chat do site pela chave pública do widget, em QUALQUER conta (a chave é o
   * que diz a conta). null = chave desconhecida ou canal de outro tipo.
   */
  async webChatByKeyAsSystem(publicKey: string): Promise<WebChatChannel | null> {
    const channel = await this.channels.findByPublicKeyAsSystem(publicKey);
    return channel ? webChatOf(channel) : null;
  }

  /** Chat do site da conta atual (o módulo de sites põe o widget no site). */
  async webChat(id: string): Promise<WebChatChannel | null> {
    const channel = await this.channels.findById(id);
    return channel ? webChatOf(channel) : null;
  }

  /** Mensagem do visitante (rota pública, no tenant do canal). Ver o use case. */
  receiveWebChatMessage(input: {
    channelId: string;
    contactId: string;
    contactName: string | null;
    externalId: string;
    text: string;
  }): Promise<void> {
    return this.receiveWebChat.execute(input);
  }

  async findByIds(ids: string[]): Promise<ChannelSummary[]> {
    if (ids.length === 0) return [];
    return (await this.channels.findByIds([...new Set(ids)])).map(summarize);
  }

  /** Lança `ChannelNotFoundError` (404) ou `ChannelNotConnectedError` (409). */
  async assertCanSend(channelId: string): Promise<void> {
    (await this.load(channelId)).assertCanSend();
  }

  /**
   * Enfileira o envio. O resultado chega depois, como
   * `ChannelMessageSendResultEvent` com o mesmo `messageId`.
   */
  async sendText(input: { channelId: string; messageId: string; to: string; text: string }) {
    await this.sender.send(await this.load(input.channelId), input);
  }

  /** Mídia já gravada no armazenamento. Resultado por evento, como no texto. */
  async sendMedia(input: {
    channelId: string;
    messageId: string;
    to: string;
    media: StoredMedia;
    caption: string | null;
  }) {
    await this.sender.sendMedia(await this.load(input.channelId), input);
  }

  private async load(id: string): Promise<Channel> {
    const channel = await this.channels.findById(id);
    if (!channel) throw new ChannelNotFoundError();
    return channel;
  }
}

function summarize(channel: Channel): ChannelSummary {
  return {
    id: channel.id,
    name: channel.name,
    provider: channel.provider,
    status: channel.status,
    teamId: channel.teamId,
  };
}

function webChatOf(channel: Channel): WebChatChannel | null {
  if (!channel.isWebChat || !channel.publicKey || !channel.settings) return null;
  return {
    channelId: channel.id,
    tenantId: channel.tenantId,
    name: channel.name,
    publicKey: channel.publicKey,
    settings: { ...channel.settings },
    active: channel.status === 'connected',
  };
}
