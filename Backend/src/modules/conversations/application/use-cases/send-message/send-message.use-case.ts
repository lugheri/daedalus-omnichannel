import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { ContactWithoutPhoneError } from '../../../domain/errors/contact-without-phone.error';
import { Message } from '../../../domain/message.entity';
import { CHANNEL_GATEWAY, type ChannelGateway } from '../../ports/channel-gateway';
import { CONTACT_DIRECTORY, type ContactDirectory } from '../../ports/contact-directory';
import { TextDelivery } from '../../text-delivery';
import { VisibleConversations } from '../../visible-conversations';

/**
 * Resposta de um membro. A mensagem é gravada como pendente e o envio vai
 * para a fila do canal; o resultado (enviada/falhou) chega depois, por evento.
 */
@Injectable()
export class SendMessageUseCase {
  constructor(
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly visible: VisibleConversations,
    private readonly delivery: TextDelivery,
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
    return this.delivery.deliver(conversation, message, contact.phone);
  }
}
