/**
 * O que as automações fazem nas conversas (módulo conversations), como
 * SISTEMA: sem membro por trás, só o tenant limita. Adapter em infra/.
 */
export interface ConversationActions {
  contactName(conversationId: string): Promise<string | null>;
  sendAutomatedMessage(conversationId: string, text: string): Promise<void>;
  /** Campo ausente = não muda; null = tira. */
  assign(
    conversationId: string,
    input: { teamId?: string | null; assigneeId?: string | null },
  ): Promise<void>;
  dispositionExists(dispositionId: string): Promise<boolean>;
}

export const CONVERSATION_ACTIONS = Symbol('KanbanConversationActions');
