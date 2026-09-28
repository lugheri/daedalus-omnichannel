import { Inject, Injectable } from '@nestjs/common';
import {
  SendWhatsAppMedia,
  SendWhatsAppText,
  type StoredMedia,
} from '../../../contracts/whatsapp-connector.contract';
import { mediaKindOf } from '../../../shared/domain/media-type';
import { JOB_QUEUE, type JobQueue } from '../../../shared/application/job-queue';
import type { Channel } from '../domain/channel.entity';
import { normalizeRecipient } from '../domain/recipient';

/**
 * Enfileira um envio (texto ou mídia) para o conector do canal. Único caminho de envio do
 * módulo: mensagem de teste e mensagens das conversas passam por aqui.
 * O resultado volta como `ChannelMessageSendResultEvent`, com o mesmo `messageId`.
 */
@Injectable()
export class ChannelSender {
  constructor(@Inject(JOB_QUEUE) private readonly jobs: JobQueue) {}

  async send(channel: Channel, input: { messageId: string; to: string; text: string }) {
    channel.assertCanSend();
    await this.jobs.add(
      SendWhatsAppText,
      {
        channelId: channel.id,
        tenantId: channel.tenantId,
        messageId: input.messageId,
        to: normalizeRecipient(input.to),
        text: input.text,
      },
      // Id estável: repetir o comando não envia duas vezes.
      { jobId: `send:${input.messageId}` },
    );
  }

  /** Mídia já gravada no armazenamento; o conector a lê de lá. */
  async sendMedia(
    channel: Channel,
    input: { messageId: string; to: string; media: StoredMedia; caption: string | null },
  ) {
    channel.assertCanSend();
    await this.jobs.add(
      SendWhatsAppMedia,
      {
        channelId: channel.id,
        tenantId: channel.tenantId,
        messageId: input.messageId,
        to: normalizeRecipient(input.to),
        kind: mediaKindOf(input.media.mimeType),
        media: input.media,
        caption: input.caption,
      },
      { jobId: `send:${input.messageId}` },
    );
  }
}
