import type { ColumnPage, Placement } from '../application/use-cases/cards.use-cases';
import type { BoardCard } from '../domain/board-card.entity';
import type { Board } from '../domain/board.entity';

/** Formato público de quadros e cards na API. */
export const BoardPresenter = {
  toHttp: (board: Board) => ({
    id: board.id,
    name: board.name,
    columns: board.columns.map((c) => ({ id: c.id, name: c.name })),
    autoAdd: board.autoAdd,
    createdAt: board.createdAt.toISOString(),
  }),
};

const card = (c: BoardCard) => ({
  id: c.id,
  boardId: c.boardId,
  columnId: c.columnId,
  conversationId: c.conversationId,
  enteredColumnAt: c.enteredColumnAt.toISOString(),
  createdAt: c.createdAt.toISOString(),
});

export const CardPresenter = {
  toHttp: card,
  page: (page: ColumnPage) => ({
    columnId: page.columnId,
    nextCursor: page.nextCursor,
    cards: page.cards.map(({ card: c, conversation }) => ({
      ...card(c),
      conversation: {
        ...conversation,
        lastMessageAt: conversation.lastMessageAt.toISOString(),
      },
    })),
  }),
  placement: ({ card: c, board, column }: Placement) => ({
    cardId: c.id,
    board: { id: board.id, name: board.name },
    column: { id: column.id, name: column.name },
    enteredColumnAt: c.enteredColumnAt.toISOString(),
  }),
};
