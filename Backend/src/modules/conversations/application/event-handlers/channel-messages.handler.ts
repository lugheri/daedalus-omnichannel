import { Injectable } from '@nestjs/common';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../../../shared/application/domain-event-handler';
import { ChannelMessageReceivedEvent, ChannelMessageSendResultEvent } from '../../../channels';
import { ApplySendResultUseCase } from '../use-cases/apply-send-result/apply-send-result.use-case';
import { RecordChannelMessageUseCase } from '../use-cases/record-channel-message/record-channel-message.use-case';

/**
 * O que acontece nos canais e vira conversa. Roda no worker, no tenant do
 * evento. Idempotente (ver os use cases): o mesmo evento pode chegar de novo.
 */
@Injectable()
export class ChannelMessagesHandler {
  constructor(
    private readonly recordMessage: RecordChannelMessageUseCase,
    private readonly applySendResult: ApplySendResultUseCase,
  ) {}

  @HandlesDomainEvent(ChannelMessageReceivedEvent)
  async onMessage(event: DeliveredEvent<ChannelMessageReceivedEvent>): Promise<void> {
    const { message } = event;
    await this.recordMessage.execute({
      channelId: event.aggregateId,
      externalId: message.externalId,
      contactPhone: message.contactPhone,
      contactName: message.contactName,
      fromMe: message.fromMe,
      kind: message.kind,
      text: message.text,
      sentAt: message.sentAt,
    });
  }

  @HandlesDomainEvent(ChannelMessageSendResultEvent)
  async onSendResult(event: DeliveredEvent<ChannelMessageSendResultEvent>): Promise<void> {
    await this.applySendResult.execute(event.result);
  }
}
