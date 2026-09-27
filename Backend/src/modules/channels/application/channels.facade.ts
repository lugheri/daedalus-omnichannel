import { Inject, Injectable } from '@nestjs/common';
import type { Channel, ChannelProvider, ChannelStatus } from '../domain/channel.entity';
import { ChannelNotFoundError } from '../domain/errors/channel-not-found.error';
import { ChannelTextSender } from './channel-text-sender';
import { CHANNEL_REPOSITORY, type ChannelRepository } from './ports/channel.repository';

/** Dados de canal expostos a outros módulos (objeto simples, nunca a entidade). */
export interface ChannelSummary {
  id: string;
  name: string;
  provider: ChannelProvider;
  status: ChannelStatus;
}

/**
 * API síncrona do módulo para outros módulos (ex.: conversations enviando
 * uma resposta). Exportada pelo `index.ts`.
 */
@Injectable()
export class ChannelsFacade {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    private readonly sender: ChannelTextSender,
  ) {}

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
  };
}
