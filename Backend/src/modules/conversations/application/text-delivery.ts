import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../shared/application/event-bus';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/unit-of-work';
import type { Conversation } from '../domain/conversation.entity';
import type { Message } from '../domain/message.entity';
import { CHANNEL_GATEWAY, type ChannelGateway } from './ports/channel-gateway';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from './ports/conversation.repository';
import { MESSAGE_REPOSITORY, type MessageRepository } from './ports/message.repository';

/**
 * Grava uma mensagem de texto pendente e a entrega à fila do canal — de um
 * membro ou de uma automação. A ordem importa: o envio só é enfileirado
 * DEPOIS de a mensagem estar gravada, senão o resultado poderia chegar antes
 * de a mensagem existir.
 */
@Injectable()
export class TextDelivery {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async deliver(conversation: Conversation, message: Message, to: string): Promise<Message> {
    conversation.addMessage(message);
    await this.persist(message, conversation);
    try {
      await this.channels.sendText({
        channelId: conversation.channelId,
        messageId: message.id,
        to,
        text: message.text ?? '',
      });
    } catch (error) {
      // Não chegou à fila (ex.: Redis fora): a mensagem fica como falha, visível na tela.
      message.applySendResult({ externalId: null, error: 'enqueue_failed' });
      await this.persist(message);
      throw error;
    }
    return message;
  }

  private async persist(message: Message, conversation?: Conversation): Promise<void> {
    await this.unitOfWork.run(async () => {
      if (conversation) await this.conversations.save(conversation);
      await this.messages.save(message);
      await this.events.publish([...(conversation?.pullEvents() ?? []), ...message.pullEvents()]);
    });
  }
}
