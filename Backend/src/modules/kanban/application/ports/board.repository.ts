import type { Board } from '../../domain/board.entity';

/** Funis (com as etapas). Tudo restrito ao tenant atual (TenantContext). */
export interface BoardRepository {
  /** Quadro e colunas juntos (colunas fora da lista são apagadas). */
  save(board: Board): Promise<void>;
  findById(id: string): Promise<Board | null>;
  /** Por nome, sem diferenciar maiúsculas. */
  findByName(name: string): Promise<Board | null>;
  /** Por nome. */
  list(): Promise<Board[]>;
  /** Quantos funis a conta tem (o funil padrão só é criado em conta sem nenhum). */
  count(): Promise<number>;
  /** Apaga o funil com etapas e negócios. */
  delete(board: Board): Promise<void>;
  /** Funis que recebem os leads do formulário do site. */
  listAcceptingLeads(): Promise<Board[]>;
  /** Funis com entrada automática para conversas novas desta equipe (null = fila geral). */
  listAcceptingNewConversations(teamId: string | null): Promise<Board[]>;
  /** Equipe excluída: funis que recebiam as conversas dela param de receber. */
  clearAutoAddTeam(teamId: string): Promise<void>;
}

export const BOARD_REPOSITORY = Symbol('BoardRepository');
