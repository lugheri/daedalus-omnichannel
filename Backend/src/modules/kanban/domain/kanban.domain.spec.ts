import { BoardCard } from './board-card.entity';
import { Board, MAX_COLUMNS } from './board.entity';
import { positionBetween } from './card-position';
import { ColumnNameTakenError } from './errors/column-name-taken.error';
import { ColumnNotFoundError } from './errors/column-not-found.error';
import { InvalidBoardError } from './errors/invalid-board.error';
import {
  BoardCardEnteredColumnEvent,
  BoardCardRepositionedEvent,
  BoardChangedEvent,
} from './events/kanban-events';

/** O código do erro de domínio que a função lança. */
function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

const board = (columns = ['Novos', 'Proposta', 'Fechados']) =>
  Board.create('b-1', {
    tenantId: 't-1',
    name: 'Vendas',
    columns: columns.map((name, i) => ({ id: `col-${i + 1}`, name })),
  });

describe('Board', () => {
  it('is created with its columns, in order, and announces the change', () => {
    const b = board();
    expect(b.columns.map((c) => c.name)).toEqual(['Novos', 'Proposta', 'Fechados']);
    expect(b.firstColumn.id).toBe('col-1');
    expect(b.pullEvents()).toEqual([expect.any(BoardChangedEvent)]);
  });

  it('validates names and needs at least one column', () => {
    expect(() =>
      Board.create('b', { tenantId: 't', name: ' ', columns: [{ id: 'c', name: 'A' }] }),
    ).toThrow(InvalidBoardError);
    expect(codeOf(() => Board.create('b', { tenantId: 't', name: 'X', columns: [] }))).toBe(
      'BOARD_NEEDS_COLUMN',
    );
    expect(codeOf(() => board(['A', 'x'.repeat(41)]))).toBe('BOARD_INVALID_COLUMN_NAME');
  });

  it('column names are unique in the board, ignoring case', () => {
    expect(() => board(['Novos', 'NOVOS'])).toThrow(ColumnNameTakenError);
    const b = board();
    expect(() => b.addColumn('col-9', ' proposta ')).toThrow(ColumnNameTakenError);
    expect(() => b.renameColumn('col-1', 'fechados')).toThrow(ColumnNameTakenError);
    b.renameColumn('col-1', 'NOVOS'); // só a caixa do próprio nome
    expect(b.column('col-1').name).toBe('NOVOS');
  });

  it(`has at most ${MAX_COLUMNS} columns`, () => {
    const b = board(Array.from({ length: MAX_COLUMNS }, (_, i) => `C${i}`));
    expect(codeOf(() => b.addColumn('extra', 'Extra'))).toBe('BOARD_TOO_MANY_COLUMNS');
  });

  it('moves columns (index clamped) and keeps at least one when removing', () => {
    const b = board();
    b.moveColumn('col-3', 0);
    expect(b.columns.map((c) => c.id)).toEqual(['col-3', 'col-1', 'col-2']);
    b.moveColumn('col-3', 99);
    expect(b.columns.map((c) => c.id)).toEqual(['col-1', 'col-2', 'col-3']);

    b.removeColumn('col-2');
    b.removeColumn('col-3');
    expect(codeOf(() => b.removeColumn('col-1'))).toBe('BOARD_NEEDS_COLUMN');
    expect(() => b.removeColumn('nope')).toThrow(ColumnNotFoundError);
  });

  it('automatic entry: all, by team, or none', () => {
    const b = board();
    expect(b.acceptsNewConversation(null)).toBe(false);
    b.setAutoAdd({ mode: 'all' });
    expect(b.acceptsNewConversation(null)).toBe(true);
    b.setAutoAdd({ mode: 'team', teamId: 'sales' });
    expect(b.acceptsNewConversation('sales')).toBe(true);
    expect(b.acceptsNewConversation('support')).toBe(false);
    expect(b.acceptsNewConversation(null)).toBe(false);
    expect(codeOf(() => b.setAutoAdd({ mode: 'team', teamId: '' }))).toBe('BOARD_INVALID_AUTO_ADD');
  });
});

describe('positionBetween', () => {
  it('places at the ends, in the middle, or asks for a renumber', () => {
    expect(positionBetween(null, null)).toBe(0);
    expect(positionBetween(null, 5)).toBe(4);
    expect(positionBetween(5, null)).toBe(6);
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(1, 1 + 1e-7)).toBeNull();
  });
});

describe('BoardCard', () => {
  const place = () =>
    BoardCard.place(
      'card-1',
      { tenantId: 't-1', boardId: 'b-1', columnId: 'col-1', conversationId: 'conv-1', position: 0 },
      'agent-1',
    );

  it('entering the board counts as entering the column', () => {
    expect(place().pullEvents()).toEqual([
      expect.objectContaining({
        eventName: BoardCardEnteredColumnEvent.eventName,
        columnId: 'col-1',
        previousColumnId: null,
        movedBy: 'agent-1',
      }),
    ]);
  });

  it('another column restarts the time in the column; the same column only repositions', () => {
    const card = place();
    card.pullEvents();
    const entered = card.enteredColumnAt;

    card.moveTo('col-1', 3, 'agent-1');
    expect(card.enteredColumnAt).toBe(entered);
    expect(card.pullEvents()).toEqual([expect.any(BoardCardRepositionedEvent)]);

    card.moveTo('col-2', 0, null);
    expect(card.columnId).toBe('col-2');
    expect(card.enteredColumnAt).not.toBe(entered);
    expect(card.pullEvents()).toEqual([
      expect.objectContaining({ columnId: 'col-2', previousColumnId: 'col-1', movedBy: null }),
    ]);
  });
});
