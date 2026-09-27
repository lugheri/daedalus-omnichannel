import type { Conversation } from '../domain/conversation.entity';
import type { ChannelGateway, ChannelInfo } from './ports/channel-gateway';
import type { ContactDirectory, ContactInfo } from './ports/contact-directory';

/** Conversa com os dados de outros módulos que a tela precisa mostrar. */
export interface ConversationView {
  conversation: Conversation;
  /** null se o contato foi apagado. */
  contact: ContactInfo | null;
  /** null se o canal foi removido (a conversa continua como histórico). */
  channel: ChannelInfo | null;
}

/** Junta contatos e canais de uma página inteira em duas consultas (sem N+1). */
export async function toViews(
  conversations: Conversation[],
  contacts: ContactDirectory,
  channels: ChannelGateway,
): Promise<ConversationView[]> {
  const [contactList, channelList] = await Promise.all([
    contacts.findByIds(conversations.map((c) => c.contactId)),
    channels.findByIds(conversations.map((c) => c.channelId)),
  ]);
  const contactById = new Map(contactList.map((c) => [c.id, c]));
  const channelById = new Map(channelList.map((c) => [c.id, c]));

  return conversations.map((conversation) => ({
    conversation,
    contact: contactById.get(conversation.contactId) ?? null,
    channel: channelById.get(conversation.channelId) ?? null,
  }));
}
