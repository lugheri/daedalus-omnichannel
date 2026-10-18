import { Inject, Injectable } from '@nestjs/common';
import {
  SendWhatsAppMedia,
  SendWhatsAppText,
  type StoredMedia,
} from '../../../contracts/whatsapp-connector.contract';
import { EVENT_BUS, type EventBus } from '../../../shared/application/event-bus';
import { JOB_QUEUE, type JobQueue } from '../../../shared/application/job-queue';
import {
  REALTIME_NOTIFIER,
  RealtimeRooms,
  WEB_CHAT_NAMESPACE,
  type RealtimeNotifier,
} from '../../../shared/application/realtime';
import { mediaKindOf } from '../../../shared/domain/media-type';
import type { Channel } from '../domain/channel.entity';
import { ChannelActionUnsupportedError } from '../domain/errors/channel-action-unsupported.error';
import { ChannelMessageSendResultEvent } from '../domain/events/channel-events';
import { normalizeRecipient } from '../domain/recipient';

/** O que o widget recebe quando chega mensagem nova para o visitante. */
export const WEB_CHAT_MESSAGE_EVENT = 'chat.message';

/**
 * Envia uma mensagem pelo canal. Único caminho de envio do módulo: mensagem
 * de teste e mensagens das conversas passam por aqui. O resultado volta como
 * `ChannelMessageSendResultEvent`, com o mesmo `messageId`.
 *
 * - WhatsApp: comando para o conector, pela fila (`to` = telefone).
 * - Chat do site: a mensagem já está gravada (conversations); "enviar" é
 *   avisar o widget do visitante, na hora (`to` = id do contato), e dar a
 *   mensagem por enviada. Visitante fora do site lê ao voltar (histórico).
 */
@Injectable()
export class ChannelSender {
  constructor(
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
    @Inject(REALTIME_NOTIFIER) private readonly realtime: RealtimeNotifier,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async send(channel: Channel, input: { messageId: string; to: string; text: string }) {
    channel.assertCanSend();
    if (channel.isWebChat) return this.deliverToVisitor(channel, input.messageId, input.to);
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

  /** Mídia já gravada no armazenamento; o conector a lê de lá. Só WhatsApp. */
  async sendMedia(
    channel: Channel,
    input: { messageId: string; to: string; media: StoredMedia; caption: string | null },
  ) {
    channel.assertCanSend();
    if (channel.isWebChat) throw new ChannelActionUnsupportedError('CHANNEL_NOT_WHATSAPP');
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

  private async deliverToVisitor(channel: Channel, messageId: string, contactId: string) {
    // Só o sinal: o widget busca as mensagens pela API (com o token do visitante).
    await this.realtime.emit(
      [RealtimeRooms.webChatVisitor(channel.id, contactId)],
      WEB_CHAT_MESSAGE_EVENT,
      { messageId },
      WEB_CHAT_NAMESPACE,
    );
    await this.events.publish([
      new ChannelMessageSendResultEvent(channel.id, channel.tenantId, {
        messageId,
        status: 'sent',
        externalId: messageId,
        error: null,
      }),
    ]);
  }
}
