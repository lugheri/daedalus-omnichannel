import { Injectable } from '@nestjs/common';
import { ChannelsFacade } from '../../channels';
import { ContactsFacade } from '../../contacts';
import { ConversationsFacade } from '../../conversations';
import type {
  VisitorMessage,
  WebChatBackend,
  WebChatInfo,
} from '../application/ports/web-chat-backend';

/** Prefixo do `externalId` das mensagens do visitante (o id que o widget gerou). */
const CLIENT_PREFIX = 'web-';

@Injectable()
export class FacadeWebChatBackend implements WebChatBackend {
  constructor(
    private readonly channels: ChannelsFacade,
    private readonly contacts: ContactsFacade,
    private readonly conversations: ConversationsFacade,
  ) {}

  async channelByKey(key: string): Promise<WebChatInfo | null> {
    const chat = await this.channels.webChatByKeyAsSystem(key);
    if (!chat) return null;
    return {
      channelId: chat.channelId,
      tenantId: chat.tenantId,
      name: chat.name,
      ...chat.settings,
      active: chat.active,
    };
  }

  async identify(input: {
    name: string;
    phone: string | null;
    email: string | null;
    channelName: string;
  }): Promise<{ contactId: string }> {
    const { contact } = await this.contacts.captureChatLead(input);
    return { contactId: contact.id };
  }

  receive(input: {
    channelId: string;
    contactId: string;
    contactName: string;
    externalId: string;
    text: string;
  }): Promise<void> {
    return this.channels.receiveWebChatMessage(input);
  }

  async history(input: {
    channelId: string;
    contactId: string;
    since: Date;
  }): Promise<VisitorMessage[]> {
    return (await this.conversations.webChatHistory(input)).map((m) => ({
      ...m,
      clientId: m.clientId?.startsWith(CLIENT_PREFIX)
        ? m.clientId.slice(CLIENT_PREFIX.length)
        : m.clientId,
    }));
  }
}
