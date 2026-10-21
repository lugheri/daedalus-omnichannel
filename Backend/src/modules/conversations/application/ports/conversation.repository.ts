import type { CursorPage } from '../../../../shared/application/pagination';
import type { Conversation, ConversationStatus } from '../../domain/conversation.entity';
import type { ConversationScope } from '../../domain/visibility';

export interface ConversationListQuery {
  scope: ConversationScope;
  status?: ConversationStatus;
  /** Só as conversas deste contato (histórico na ficha do contato). */
  contactId?: string;
  /** Recorte dentro do escopo: só as minhas, ou só as sem responsável. */
  assignee?: 'me' | 'none';
  /** O membro da requisição (para "as minhas"). */
  me: string;
  limit: number;
  /** Cursor opaco devolvido pela página anterior. */
  cursor?: string;
}

/** Toda operação é restrita ao tenant da operação atual (TenantContext). */
export interface ConversationRepository {
  /**
   * Cria, ou atualiza SÓ os campos alterados (`changedFields`) — nunca a
   * linha inteira, para não desfazer o que outro processo gravou no meio.
   */
  save(conversation: Conversation): Promise<void>;
  /**
   * "Assumir" atômico: grava o responsável só se a conversa continua sem
   * nenhum. `false` = alguém assumiu antes (ou a conversa não existe). A
   * garantia é do banco (UPDATE condicional), não de uma leitura anterior.
   */
  claimUnassigned(conversationId: string, membershipId: string): Promise<boolean>;
  findById(id: string): Promise<Conversation | null>;
  /** As que existem entre os ids (em qualquer ordem). */
  findByIds(ids: string[]): Promise<Conversation[]>;
  findByChannelAndContact(channelId: string, contactId: string): Promise<Conversation | null>;
  /** Mais recentes (última mensagem) primeiro, dentro do escopo. */
  list(query: ConversationListQuery): Promise<CursorPage<Conversation>>;
  /** Equipe excluída: as conversas dela vão para a fila geral. */
  clearTeam(teamId: string): Promise<void>;
}

export const CONVERSATION_REPOSITORY = Symbol('ConversationRepository');
