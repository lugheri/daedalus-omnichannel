import { Inject, Injectable } from '@nestjs/common';
import { SendWhatsAppText } from '../../../contracts/whatsapp-connector.contract';
import { JOB_QUEUE, type JobQueue } from '../../../shared/application/job-queue';
import type { Channel } from '../domain/channel.entity';
import { normalizeRecipient } from '../domain/recipient';

/**
 * Enfileira um texto para o conector do canal. Único caminho de envio do
 * módulo: mensagem de teste e mensagens das conversas passam por aqui.
 * O resultado volta como `ChannelMessageSendResultEvent`, com o mesmo `messageId`.
 */
@Injectable()
export class ChannelTextSender {
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
}
