import type { Deal } from '../../domain/deal.entity';

/** Posição de um negócio na ordem da etapa: (position, id), crescente. */
export interface DealKey {
  position: number;
  id: string;
}

/** Negócios dos funis. Tudo restrito ao tenant atual (TenantContext). */
export interface DealRepository {
  save(deal: Deal): Promise<void>;
  delete(deal: Deal): Promise<void>;
  findById(id: string): Promise<Deal | null>;
  /** O negócio EM ABERTO do contato neste funil (o mais antigo), se houver. */
  findOpenOnBoard(boardId: string, contactId: string): Promise<Deal | null>;
  /** Negócios em aberto ligados à conversa. */
  listOpenByConversation(conversationId: string): Promise<Deal[]>;
  /** Todos os negócios do contato (abertos e fechados), mais recentes primeiro. */
  listByContact(contactId: string): Promise<Deal[]>;
  /** Negócios EM ABERTO da etapa, de cima para baixo, a partir de depois de `after`. */
  listColumn(columnId: string, page: { after?: DealKey; limit: number }): Promise<Deal[]>;
  /** O primeiro negócio em aberto da etapa (ignorando `excludeId`). */
  first(columnId: string, excludeId?: string): Promise<Deal | null>;
  /** O último negócio da etapa. */
  last(columnId: string): Promise<Deal | null>;
  /** O negócio em aberto logo abaixo de `key` na etapa (ignorando `excludeId`). */
  next(columnId: string, key: DealKey, excludeId?: string): Promise<Deal | null>;
  /** Todos os negócios na etapa, inclusive fechados (eles guardam a etapa onde pararam). */
  countInColumn(columnId: string): Promise<number>;
  /** Refaz as posições da etapa como 0, 1, 2... mantendo a ordem. */
  renumber(columnId: string): Promise<void>;
  /**
   * Leva todos os negócios de uma etapa para o fim de outra, na mesma ordem
   * (exclusão de etapa). Em massa: não dispara as automações de entrada.
   */
  moveAll(fromColumnId: string, toColumnId: string): Promise<void>;
}

export const DEAL_REPOSITORY = Symbol('DealRepository');
