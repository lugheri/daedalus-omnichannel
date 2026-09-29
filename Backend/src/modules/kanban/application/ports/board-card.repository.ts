import type { BoardCard } from '../../domain/board-card.entity';

/** Posição de um card na ordem da coluna: (position, id), crescente. */
export interface CardKey {
  position: number;
  id: string;
}

/** Cards dos quadros. Tudo restrito ao tenant atual (TenantContext). */
export interface BoardCardRepository {
  save(card: BoardCard): Promise<void>;
  delete(card: BoardCard): Promise<void>;
  findById(id: string): Promise<BoardCard | null>;
  findOnBoard(boardId: string, conversationId: string): Promise<BoardCard | null>;
  /** Em que quadros a conversa está. */
  listByConversation(conversationId: string): Promise<BoardCard[]>;
  /** Cards da coluna, de cima para baixo, a partir de depois de `after`. */
  listColumn(columnId: string, page: { after?: CardKey; limit: number }): Promise<BoardCard[]>;
  /** O primeiro card da coluna (ignorando `excludeId`). */
  first(columnId: string, excludeId?: string): Promise<BoardCard | null>;
  /** O último card da coluna. */
  last(columnId: string): Promise<BoardCard | null>;
  /** O card logo abaixo de `key` na coluna (ignorando `excludeId`). */
  next(columnId: string, key: CardKey, excludeId?: string): Promise<BoardCard | null>;
  countInColumn(columnId: string): Promise<number>;
  /** Refaz as posições da coluna como 0, 1, 2... mantendo a ordem. */
  renumber(columnId: string): Promise<void>;
  /**
   * Leva todos os cards de uma coluna para o fim de outra, na mesma ordem
   * (exclusão de coluna). Em massa: não dispara as automações de entrada.
   */
  moveAll(fromColumnId: string, toColumnId: string): Promise<void>;
}

export const BOARD_CARD_REPOSITORY = Symbol('BoardCardRepository');
