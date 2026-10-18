import { Inject, Injectable } from '@nestjs/common';
import type { Conversation } from '../domain/conversation.entity';
import { ContactWithoutPhoneError } from '../domain/errors/contact-without-phone.error';
import { CHANNEL_GATEWAY, type ChannelGateway, type ChannelKind } from './ports/channel-gateway';
import { CONTACT_DIRECTORY, type ContactDirectory } from './ports/contact-directory';

/**
 * Para quem vai a resposta, no endereço que o canal da conversa usa: o
 * telefone do contato no WhatsApp (sem telefone, 409); no chat do site, o
 * próprio contato (o widget dele recebe o aviso).
 */
@Injectable()
export class ConversationRecipient {
  constructor(
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
  ) {}

  async of(conversation: Conversation): Promise<{ to: string; kind: ChannelKind }> {
    const [channel] = await this.channels.findByIds([conversation.channelId]);
    const kind = channel?.kind ?? 'whatsapp';
    if (kind === 'web_chat') return { to: conversation.contactId, kind };
    const contact = await this.contacts.findById(conversation.contactId);
    if (!contact?.phone) throw new ContactWithoutPhoneError();
    return { to: contact.phone, kind };
  }
}
