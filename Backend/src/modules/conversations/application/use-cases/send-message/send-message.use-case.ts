import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { Message } from '../../../domain/message.entity';
import { CHANNEL_GATEWAY, type ChannelGateway } from '../../ports/channel-gateway';
import { ConversationRecipient } from '../../conversation-recipient';
import { TextDelivery } from '../../text-delivery';
import { VisibleConversations } from '../../visible-conversations';

/**
 * Resposta de um membro. A mensagem é gravada como pendente e o envio vai
 * para a fila do canal; o resultado (enviada/falhou) chega depois, por evento.
 */
@Injectable()
export class SendMessageUseCase {
  constructor(
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly visible: VisibleConversations,
    private readonly delivery: TextDelivery,
    private readonly recipient: ConversationRecipient,
  ) {}

  async execute(input: { conversationId: string; text: string }): Promise<Message> {
    const { conversation, member } = await this.visible.load(input.conversationId);
    const { to } = await this.recipient.of(conversation);
    // Falha cedo (409) se o canal caiu, em vez de gravar uma mensagem fadada a falhar.
    await this.channels.assertCanSend(conversation.channelId);

    const message = Message.outbound(this.ids.generate(), {
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      channelId: conversation.channelId,
      text: input.text,
      senderMembershipId: member.membershipId,
    });
    return this.delivery.deliver(conversation, message, to);
  }
}
