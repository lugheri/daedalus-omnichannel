import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { FILE_STORAGE, type FileStorage } from '../../../../../shared/application/file-storage';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { baseMimeType, mediaKindOf } from '../../../../../shared/domain/media-type';
import type { Conversation } from '../../../domain/conversation.entity';
import { ContactWithoutPhoneError } from '../../../domain/errors/contact-without-phone.error';
import { EmptyAttachmentError } from '../../../domain/errors/empty-attachment.error';
import { Message } from '../../../domain/message.entity';
import { CHANNEL_GATEWAY, type ChannelGateway } from '../../ports/channel-gateway';
import { CONTACT_DIRECTORY, type ContactDirectory } from '../../ports/contact-directory';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/conversation.repository';
import { MESSAGE_REPOSITORY, type MessageRepository } from '../../ports/message.repository';
import { VisibleConversations } from '../../visible-conversations';

export interface SendAttachmentInput {
  conversationId: string;
  content: Buffer;
  mimeType: string;
  fileName: string | null;
  caption: string | null;
}

/**
 * Anexo enviado por um membro: grava no armazenamento, registra a mensagem
 * como pendente e só então pede o envio ao canal (o conector lê o arquivo
 * do armazenamento). O tamanho máximo é barrado antes, no upload (HTTP).
 */
@Injectable()
export class SendAttachmentUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly visible: VisibleConversations,
  ) {}

  async execute(input: SendAttachmentInput): Promise<Message> {
    if (input.content.length === 0) throw new EmptyAttachmentError();
    const { conversation, member } = await this.visible.load(input.conversationId);
    const contact = await this.contacts.findById(conversation.contactId);
    if (!contact?.phone) throw new ContactWithoutPhoneError();
    await this.channels.assertCanSend(conversation.channelId);

    const messageId = this.ids.generate();
    const mimeType = baseMimeType(input.mimeType);
    const key = `tenants/${conversation.tenantId}/conversations/${conversation.id}/outbound/${messageId}`;
    await this.storage.put(key, input.content, mimeType);

    const media = { key, mimeType, size: input.content.length, fileName: input.fileName };
    const message = Message.outboundMedia(messageId, {
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      channelId: conversation.channelId,
      kind: mediaKindOf(mimeType),
      media,
      caption: input.caption,
      senderMembershipId: member.membershipId,
    });
    conversation.addMessage(message);
    await this.persist(message, conversation);

    try {
      await this.channels.sendMedia({
        channelId: conversation.channelId,
        messageId,
        to: contact.phone,
        media,
        caption: message.text,
      });
    } catch (error) {
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
