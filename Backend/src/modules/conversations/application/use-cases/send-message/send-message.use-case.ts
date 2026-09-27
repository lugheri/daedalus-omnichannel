import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import type { Conversation } from '../../../domain/conversation.entity';
import { ContactWithoutPhoneError } from '../../../domain/errors/contact-without-phone.error';
import { Message } from '../../../domain/message.entity';
import { CHANNEL_GATEWAY, type ChannelGateway } from '../../ports/channel-gateway';
import { CONTACT_DIRECTORY, type ContactDirectory } from '../../ports/contact-directory';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/conversation.repository';
import { MESSAGE_REPOSITORY, type MessageRepository } from '../../ports/message.repository';
import { VisibleConversations } from '../../visible-conversations';

/**
 * Resposta de um membro. A mensagem é gravada como pendente e o envio vai
 * para a fila do canal; o resultado (enviada/falhou) chega depois, por evento.
 *
 * A ordem importa: o envio só é enfileirado DEPOIS de a mensagem estar
 * gravada — senão o resultado poderia chegar antes de a mensagem existir.
 */
@Injectable()
export class SendMessageUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly visible: VisibleConversations,
  ) {}

  async execute(input: { conversationId: string; text: string }): Promise<Message> {
    const { conversation, member } = await this.visible.load(input.conversationId);
    const contact = await this.contacts.findById(conversation.contactId);
    if (!contact?.phone) throw new ContactWithoutPhoneError();
    // Falha cedo (409) se o canal caiu, em vez de gravar uma mensagem fadada a falhar.
    await this.channels.assertCanSend(conversation.channelId);

    const message = Message.outbound(this.ids.generate(), {
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      channelId: conversation.channelId,
      text: input.text,
      senderMembershipId: member.membershipId,
    });
    conversation.addMessage(message);
    await this.persist(message, conversation);

    try {
      await this.channels.sendText({
        channelId: conversation.channelId,
        messageId: message.id,
        to: contact.phone,
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
