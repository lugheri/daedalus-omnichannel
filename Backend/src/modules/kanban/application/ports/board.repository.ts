import type { Board } from '../../domain/board.entity';

/** Quadros (com as colunas). Tudo restrito ao tenant atual (TenantContext). */
export interface BoardRepository {
  /** Quadro e colunas juntos (colunas fora da lista são apagadas). */
  save(board: Board): Promise<void>;
  findById(id: string): Promise<Board | null>;
  /** Por nome, sem diferenciar maiúsculas. */
  findByName(name: string): Promise<Board | null>;
  /** Por nome. */
  list(): Promise<Board[]>;
  /** Apaga o quadro com colunas e cards. */
  delete(board: Board): Promise<void>;
  /** Quadros com entrada automática para conversas novas desta equipe (null = fila geral). */
  listAcceptingNewConversations(teamId: string | null): Promise<Board[]>;
  /** Equipe excluída: quadros que recebiam as conversas dela param de receber. */
  clearAutoAddTeam(teamId: string): Promise<void>;
}

export const BOARD_REPOSITORY = Symbol('BoardRepository');
