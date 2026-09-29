/**
 * O que o kanban precisa das conversas (módulo conversations), sempre no
 * escopo do membro da requisição. Adapter em infra/ sobre a facade.
 */
export interface CardConversation {
  id: string;
  status: 'open' | 'pending' | 'resolved';
  assigneeId: string | null;
  dispositionId: string | null;
  unreadCount: number;
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  contact: { id: string; name: string | null; phone: string | null };
  channel: { id: string; name: string | null };
  team: { id: string; name: string } | null;
}

export interface ConversationDirectory {
  /** Das informadas, as que o membro vê (na ordem dos ids). */
  visible(ids: string[]): Promise<CardConversation[]>;
  isVisible(id: string): Promise<boolean>;
}

export const CONVERSATION_DIRECTORY = Symbol('KanbanConversationDirectory');
