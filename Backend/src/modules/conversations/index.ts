/**
 * API pública do módulo conversations. Outros módulos só podem importar daqui.
 */
export { CONVERSATION_CHANGED } from './application/event-handlers/notify-realtime.handler';
export { ConversationsModule } from './conversations.module';
export type { ConversationStatus } from './domain/conversation.entity';
export {
  ConversationAssignedEvent,
  ConversationDispositionSetEvent,
  ConversationMessageAddedEvent,
  ConversationMessageStatusChangedEvent,
  ConversationStatusChangedEvent,
  ConversationTeamChangedEvent,
} from './domain/events/conversation-events';
export type { MessageDirection, MessageStatus } from './domain/message.entity';
