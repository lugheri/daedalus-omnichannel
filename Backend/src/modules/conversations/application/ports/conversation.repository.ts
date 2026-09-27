import type { CursorPage } from '../../../../shared/application/pagination';
import type { Conversation, ConversationStatus } from '../../domain/conversation.entity';
import type { ConversationScope } from '../../domain/visibility';

export interface ConversationListQuery {
  scope: ConversationScope;
  status?: ConversationStatus;
  limit: number;
  /** Cursor opaco devolvido pela página anterior. */
  cursor?: string;
}

/** Toda operação é restrita ao tenant da operação atual (TenantContext). */
export interface ConversationRepository {
  save(conversation: Conversation): Promise<void>;
  findById(id: string): Promise<Conversation | null>;
  findByChannelAndContact(channelId: string, contactId: string): Promise<Conversation | null>;
  /** Mais recentes (última mensagem) primeiro, dentro do escopo. */
  list(query: ConversationListQuery): Promise<CursorPage<Conversation>>;
}

export const CONVERSATION_REPOSITORY = Symbol('ConversationRepository');
