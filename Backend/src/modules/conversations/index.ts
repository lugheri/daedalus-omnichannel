/**
 * API pública do módulo conversations. Outros módulos só podem importar daqui.
 */
export { CONVERSATION_CHANGED } from './application/event-handlers/notify-realtime.handler';
export { ConversationsFacade, type ConversationSummary } from './application/conversations.facade';
export type { WebChatHistoryItem } from './application/use-cases/web-chat-history/web-chat-history.use-case';
export { ConversationsModule } from './conversations.module';
export type { ConversationStatus } from './domain/conversation.entity';
export {
  ConversationAssignedEvent,
  ConversationDispositionSetEvent,
  ConversationMessageAddedEvent,
  ConversationMessageStatusChangedEvent,
  ConversationStartedEvent,
  ConversationStatusChangedEvent,
  ConversationTeamChangedEvent,
} from './domain/events/conversation-events';
export type { MessageDirection, MessageStatus } from './domain/message.entity';
