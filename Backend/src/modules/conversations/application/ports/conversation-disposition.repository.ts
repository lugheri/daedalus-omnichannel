import type { ConversationDisposition } from '../../domain/conversation-disposition.entity';

/** Histórico de tabulações dos atendimentos (tenant atual). */
export interface ConversationDispositionRepository {
  save(record: ConversationDisposition): Promise<void>;
  /** Mais recentes primeiro. */
  listByConversation(conversationId: string): Promise<ConversationDisposition[]>;
}

export const CONVERSATION_DISPOSITION_REPOSITORY = Symbol('ConversationDispositionRepository');
