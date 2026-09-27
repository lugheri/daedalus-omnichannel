import type { ConversationView } from '../application/conversation-view';
import type { Message } from '../domain/message.entity';

/** Formato público de conversas e mensagens na API. */
export const ConversationPresenter = {
  toHttp: ({ conversation, contact, channel }: ConversationView) => ({
    id: conversation.id,
    status: conversation.status,
    assigneeId: conversation.assigneeId,
    unreadCount: conversation.unreadCount,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    lastMessagePreview: conversation.lastMessagePreview,
    createdAt: conversation.createdAt.toISOString(),
    contact: contact
      ? { id: contact.id, name: contact.name, phone: contact.phone }
      : { id: conversation.contactId, name: null, phone: null },
    channel: channel
      ? { id: channel.id, name: channel.name }
      : { id: conversation.channelId, name: null },
  }),
};

export const MessagePresenter = {
  toHttp: (message: Message) => ({
    id: message.id,
    conversationId: message.conversationId,
    direction: message.direction,
    kind: message.kind,
    text: message.text,
    status: message.status,
    error: message.error,
    senderMembershipId: message.senderMembershipId,
    sentAt: message.sentAt.toISOString(),
  }),
};
