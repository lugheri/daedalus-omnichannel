import type { ColumnPage, DealPlacement, DealView } from '../application/use-cases/deals.use-cases';
import type { Board } from '../domain/board.entity';
import type { Deal } from '../domain/deal.entity';

/** Formato público de funis e negócios na API. */
export const BoardPresenter = {
  toHttp: (board: Board) => ({
    id: board.id,
    name: board.name,
    columns: board.columns.map((c) => ({ id: c.id, name: c.name })),
    autoAdd: board.autoAdd,
    autoAddLeads: board.autoAddLeads,
    createdAt: board.createdAt.toISOString(),
  }),
};

const deal = (d: Deal) => ({
  id: d.id,
  boardId: d.boardId,
  columnId: d.columnId,
  contactId: d.contactId,
  conversationId: d.conversationId,
  title: d.title,
  valueCents: d.valueCents,
  ownerId: d.ownerId,
  status: d.status,
  lostReason: d.lostReason,
  closedAt: d.closedAt?.toISOString() ?? null,
  enteredColumnAt: d.enteredColumnAt.toISOString(),
  createdAt: d.createdAt.toISOString(),
});

const view = ({ deal: d, contact, conversation }: DealView) => ({
  ...deal(d),
  contact,
  /** Só se o membro vê a conversa. */
  conversation: conversation && {
    ...conversation,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
  },
});

export const DealPresenter = {
  toHttp: deal,
  view,
  page: (page: ColumnPage) => ({
    columnId: page.columnId,
    nextCursor: page.nextCursor,
    deals: page.deals.map(view),
  }),
  placed: (p: DealPlacement) => ({
    ...view(p),
    board: { id: p.board.id, name: p.board.name },
    column: { id: p.column.id, name: p.column.name },
  }),
};
