import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { ColumnNameTakenError } from './errors/column-name-taken.error';
import { ColumnNotFoundError } from './errors/column-not-found.error';
import { InvalidBoardError } from './errors/invalid-board.error';
import { BoardChangedEvent } from './events/kanban-events';

export const BOARD_NAME_MAX = 60;
export const COLUMN_NAME_MAX = 40;
export const MAX_COLUMNS = 20;

export interface BoardColumn {
  id: string;
  name: string;
}

/** Entrada automática de conversas novas na primeira coluna. */
export type AutoAdd = { mode: 'none' } | { mode: 'all' } | { mode: 'team'; teamId: string };

export const AUTO_ADD_MODES = ['none', 'all', 'team'] as const;

export interface BoardProps {
  tenantId: string;
  name: string;
  /** Na ordem de exibição (esquerda → direita). */
  columns: BoardColumn[];
  autoAdd: AutoAdd;
  createdAt: Date;
}

/**
 * Quadro kanban da conta. As colunas fazem parte do agregado (poucas, e as
 * regras envolvem todas: nomes únicos, ordem, mínimo de uma). Os cards são
 * um agregado à parte (muitos, e mudam o tempo todo).
 */
export class Board extends AggregateRoot<BoardProps> {
  static create(
    id: string,
    input: { tenantId: string; name: string; columns: BoardColumn[] },
  ): Board {
    const board = new Board(id, {
      tenantId: input.tenantId,
      name: validName(input.name),
      columns: [],
      autoAdd: { mode: 'none' },
      createdAt: new Date(),
    });
    for (const column of input.columns) board.pushColumn(column.id, column.name);
    if (board.props.columns.length === 0) throw new InvalidBoardError('BOARD_NEEDS_COLUMN');
    board.changed();
    return board;
  }

  static restore(id: string, props: BoardProps): Board {
    return new Board(id, props);
  }

  rename(name: string): void {
    this.props.name = validName(name);
    this.changed();
  }

  /** Quem é a equipe (se existe), o use case confere. */
  setAutoAdd(autoAdd: AutoAdd): void {
    if (autoAdd.mode === 'team' && !autoAdd.teamId) {
      throw new InvalidBoardError('BOARD_INVALID_AUTO_ADD');
    }
    this.props.autoAdd = autoAdd;
    this.changed();
  }

  /** Nova coluna no fim. */
  addColumn(id: string, name: string): BoardColumn {
    const column = this.pushColumn(id, name);
    this.changed();
    return column;
  }

  renameColumn(columnId: string, name: string): void {
    const column = this.column(columnId);
    const valid = validColumnName(name);
    this.assertColumnNameFree(valid, columnId);
    column.name = valid;
    this.changed();
  }

  /** Leva a coluna para a posição `index` (0 = primeira). */
  moveColumn(columnId: string, index: number): void {
    const column = this.column(columnId);
    const rest = this.props.columns.filter((c) => c.id !== columnId);
    const target = Math.max(0, Math.min(index, rest.length));
    rest.splice(target, 0, column);
    this.props.columns = rest;
    this.changed();
  }

  /** Os cards dela, o use case já levou para outra coluna. */
  removeColumn(columnId: string): void {
    this.column(columnId);
    if (this.props.columns.length === 1) throw new InvalidBoardError('BOARD_NEEDS_COLUMN');
    this.props.columns = this.props.columns.filter((c) => c.id !== columnId);
    this.changed();
  }

  markDeleted(): void {
    this.addEvent(new BoardChangedEvent(this.id, this.props.tenantId, true));
  }

  hasColumn(columnId: string): boolean {
    return this.props.columns.some((c) => c.id === columnId);
  }

  /** Lança se a coluna não é deste quadro. */
  column(columnId: string): BoardColumn {
    const column = this.props.columns.find((c) => c.id === columnId);
    if (!column) throw new ColumnNotFoundError();
    return column;
  }

  get firstColumn(): BoardColumn {
    return this.props.columns[0];
  }

  /** Recebe conversas novas desta equipe (null = fila geral)? */
  acceptsNewConversation(teamId: string | null): boolean {
    const { autoAdd } = this.props;
    return autoAdd.mode === 'all' || (autoAdd.mode === 'team' && autoAdd.teamId === teamId);
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get name() {
    return this.props.name;
  }
  get columns(): readonly BoardColumn[] {
    return this.props.columns;
  }
  get autoAdd(): AutoAdd {
    return this.props.autoAdd;
  }
  get createdAt() {
    return this.props.createdAt;
  }

  private pushColumn(id: string, name: string): BoardColumn {
    if (this.props.columns.length >= MAX_COLUMNS) {
      throw new InvalidBoardError('BOARD_TOO_MANY_COLUMNS');
    }
    const column = { id, name: validColumnName(name) };
    this.assertColumnNameFree(column.name);
    this.props.columns.push(column);
    return column;
  }

  private assertColumnNameFree(name: string, selfId?: string): void {
    const lower = name.toLocaleLowerCase('pt-BR');
    const taken = this.props.columns.some(
      (c) => c.id !== selfId && c.name.toLocaleLowerCase('pt-BR') === lower,
    );
    if (taken) throw new ColumnNameTakenError();
  }

  private changed(): void {
    // Um aviso por operação basta para as telas recarregarem o quadro.
    this.pullEvents();
    this.addEvent(new BoardChangedEvent(this.id, this.props.tenantId, false));
  }
}

function tidy(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function validName(raw: string): string {
  const name = tidy(raw);
  if (name.length === 0 || name.length > BOARD_NAME_MAX) {
    throw new InvalidBoardError('BOARD_INVALID_NAME');
  }
  return name;
}

function validColumnName(raw: string): string {
  const name = tidy(raw);
  if (name.length === 0 || name.length > COLUMN_NAME_MAX) {
    throw new InvalidBoardError('BOARD_INVALID_COLUMN_NAME');
  }
  return name;
}
