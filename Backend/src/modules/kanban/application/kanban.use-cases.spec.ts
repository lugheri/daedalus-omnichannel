import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  InMemoryActorContext,
  RecordingEventBus,
  RecordingRealtimeNotifier,
  SequentialIdGenerator,
} from '../../../shared/testing/fakes';
import { ConversationStartedEvent } from '../../conversations';
import { TeamDeletedEvent } from '../../teams';
import { BoardCardEnteredColumnEvent } from '../domain/events/kanban-events';
import { BoardConversationNotFoundError } from '../domain/errors/board-conversation-not-found.error';
import { BoardNameTakenError } from '../domain/errors/board-name-taken.error';
import { BoardNotFoundError } from '../domain/errors/board-not-found.error';
import { CardAlreadyOnBoardError } from '../domain/errors/card-already-on-board.error';
import { CardNotFoundError } from '../domain/errors/card-not-found.error';
import { ColumnNotEmptyError } from '../domain/errors/column-not-empty.error';
import { ColumnNotFoundError } from '../domain/errors/column-not-found.error';
import { InvalidBoardTeamError } from '../domain/errors/invalid-board-team.error';
import {
  FakeConversationDirectory,
  FakeTeamDirectory,
  InMemoryBoardCardRepository,
  InMemoryAutomationRuleRepository,
  InMemoryBoardRepository,
} from '../testing/fakes';
import { KanbanAutoAddHandler } from './event-handlers/kanban-auto-add.handler';
import { BOARD_CHANGED, KanbanRealtimeHandler } from './event-handlers/kanban-realtime.handler';
import { KanbanTeamCleanupHandler } from './event-handlers/kanban-team-cleanup.handler';
import {
  AddColumnUseCase,
  BoardsReader,
  CreateBoardUseCase,
  DeleteBoardUseCase,
  DeleteColumnUseCase,
  UpdateBoardUseCase,
  UpdateColumnUseCase,
} from './use-cases/boards.use-cases';
import {
  AddCardUseCase,
  ListBoardCardsUseCase,
  ListConversationPlacementsUseCase,
  MoveCardUseCase,
  RemoveCardUseCase,
} from './use-cases/cards.use-cases';

/** Como o evento chega ao handler (dados + id da entrega). */
const delivered = <E extends object>(event: E) => ({ ...event, eventId: 'evt-1' }) as never;

describe('Kanban', () => {
  let tenant: FakeTenantContext;
  let cards: InMemoryBoardCardRepository;
  let boards: InMemoryBoardRepository;
  let conversations: FakeConversationDirectory;
  let actors: InMemoryActorContext;
  let events: RecordingEventBus;
  let ids: SequentialIdGenerator;
  const uow = new ImmediateUnitOfWork();
  const teams = new FakeTeamDirectory(['team-sales']);

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    cards = new InMemoryBoardCardRepository(tenant);
    boards = new InMemoryBoardRepository(tenant, cards);
    conversations = new FakeConversationDirectory();
    actors = new InMemoryActorContext();
    actors.authenticate({
      userId: 'u-1',
      tenantId: 'tenant-a',
      membershipId: 'agent-1',
      sessionId: 's',
    });
    events = new RecordingEventBus();
    ids = new SequentialIdGenerator();
  });

  const reader = () => new BoardsReader(boards);
  const create = (name = 'Vendas', columns?: string[]) =>
    new CreateBoardUseCase(boards, events, uow, tenant, ids).execute({ name, columns });
  const update = (id: string, input: Parameters<UpdateBoardUseCase['execute']>[1]) =>
    new UpdateBoardUseCase(boards, events, uow, teams).execute(id, input);
  const add = (boardId: string, conversationId: string, columnId?: string) =>
    new AddCardUseCase(reader(), cards, conversations, actors, tenant, ids, events, uow).execute({
      boardId,
      conversationId,
      columnId,
    });
  const move = (boardId: string, cardId: string, columnId: string, afterCardId: string | null) =>
    new MoveCardUseCase(reader(), cards, conversations, actors, events, uow).execute({
      boardId,
      cardId,
      columnId,
      afterCardId,
    });
  const list = (
    boardId: string,
    input: { columnId?: string; cursor?: string; limit?: number } = {},
  ) =>
    new ListBoardCardsUseCase(reader(), cards, conversations).execute(boardId, {
      limit: 50,
      ...input,
    });
  /** Conversas de cada coluna, de cima para baixo. */
  const layout = async (boardId: string) =>
    (await list(boardId)).map((column) => column.cards.map((c) => c.conversation.id));

  describe('boards', () => {
    it('a new board comes with the default columns', async () => {
      const board = await create();
      expect(board.columns.map((c) => c.name)).toEqual(['Novos', 'Em atendimento', 'Concluídos']);
      expect((await reader().list()).map((b) => b.name)).toEqual(['Vendas']);
    });

    it('names are unique in the account, ignoring case', async () => {
      const sales = await create('Vendas');
      const support = await create('Suporte', ['Aberto']);
      await expect(create('VENDAS')).rejects.toThrow(BoardNameTakenError);
      await expect(update(support.id, { name: 'vendas' })).rejects.toThrow(BoardNameTakenError);
      await expect(update(sales.id, { name: 'VENDAS' })).resolves.toBeDefined();

      tenant.switchTo('tenant-b');
      await expect(create('Vendas')).resolves.toBeDefined();
      await expect(reader().get(sales.id)).rejects.toThrow(BoardNotFoundError);
    });

    it('automatic entry by team needs an existing team', async () => {
      const board = await create();
      await expect(
        update(board.id, { autoAdd: { mode: 'team', teamId: 'ghost' } }),
      ).rejects.toThrow(InvalidBoardTeamError);
      const updated = await update(board.id, { autoAdd: { mode: 'team', teamId: 'team-sales' } });
      expect(updated.autoAdd).toEqual({ mode: 'team', teamId: 'team-sales' });
    });

    it('adds, renames and moves columns', async () => {
      const board = await create('Vendas', ['A', 'B']);
      const withC = await new AddColumnUseCase(boards, events, uow, ids).execute(board.id, 'C');
      const c = withC.columns[2];
      const updated = await new UpdateColumnUseCase(boards, events, uow).execute(board.id, c.id, {
        name: 'Fechados',
        index: 0,
      });
      expect(updated.columns.map((col) => col.name)).toEqual(['Fechados', 'A', 'B']);
      await expect(
        new UpdateColumnUseCase(boards, events, uow).execute(board.id, 'nope', { name: 'X' }),
      ).rejects.toThrow(ColumnNotFoundError);
    });

    it('deleting a column with cards needs a destination; they go to its end, in order', async () => {
      const board = await create('Vendas', ['A', 'B']);
      const [a, b] = board.columns;
      await add(board.id, 'conv-1', a.id);
      await add(board.id, 'conv-2', a.id); // topo: conv-2, conv-1
      await add(board.id, 'conv-3', b.id);
      const remove = (moveTo?: string) =>
        new DeleteColumnUseCase(
          boards,
          events,
          uow,
          cards,
          new InMemoryAutomationRuleRepository(tenant),
        ).execute(board.id, a.id, moveTo);

      await expect(remove()).rejects.toThrow(ColumnNotEmptyError);
      await expect(remove(a.id)).rejects.toThrow(ColumnNotEmptyError);
      const updated = await remove(b.id);

      expect(updated.columns.map((c) => c.name)).toEqual(['B']);
      expect(await layout(board.id)).toEqual([['conv-3', 'conv-2', 'conv-1']]);
      // Em massa: nenhuma automação de entrada disparada.
      expect(
        events.published.filter(
          (e) => e instanceof BoardCardEnteredColumnEvent && e.columnId === b.id,
        ),
      ).toHaveLength(1);
    });

    it('an empty column is deleted without destination; the last one stays', async () => {
      const board = await create('Vendas', ['A', 'B']);
      const remove = (columnId: string) =>
        new DeleteColumnUseCase(
          boards,
          events,
          uow,
          cards,
          new InMemoryAutomationRuleRepository(tenant),
        ).execute(board.id, columnId);
      await remove(board.columns[0].id);
      await expect(remove(board.columns[1].id)).rejects.toMatchObject({
        code: 'BOARD_NEEDS_COLUMN',
      });
    });

    it('deleting the board takes its cards', async () => {
      const board = await create();
      await add(board.id, 'conv-1');
      await new DeleteBoardUseCase(boards, events, uow).execute(board.id);
      expect(cards.items).toHaveLength(0);
      await expect(reader().get(board.id)).rejects.toThrow(BoardNotFoundError);
    });
  });

  describe('cards', () => {
    it('a card enters on top of the first column, once per board', async () => {
      const board = await create();
      await add(board.id, 'conv-1');
      const card = await add(board.id, 'conv-2');

      expect(await layout(board.id)).toEqual([['conv-2', 'conv-1'], [], []]);
      expect(events.published.at(-1)).toMatchObject({
        eventName: BoardCardEnteredColumnEvent.eventName,
        aggregateId: card.id,
        columnId: board.firstColumn.id,
        previousColumnId: null,
        movedBy: 'agent-1',
      });
      await expect(add(board.id, 'conv-1')).rejects.toThrow(CardAlreadyOnBoardError);

      // Em outro quadro, pode.
      const other = await create('Pós-venda');
      await expect(add(other.id, 'conv-1')).resolves.toBeDefined();
    });

    it("only conversations the member sees; a column must be the board's", async () => {
      const board = await create();
      const other = await create('Outro');
      conversations.hidden.add('conv-secret');
      await expect(add(board.id, 'conv-secret')).rejects.toThrow(BoardConversationNotFoundError);
      await expect(add(board.id, 'conv-1', other.firstColumn.id)).rejects.toThrow(
        ColumnNotFoundError,
      );
    });

    it('moves within and across columns, reporting the entry', async () => {
      const board = await create();
      const [novos, atendimento] = board.columns;
      const c1 = await add(board.id, 'conv-1');
      const c2 = await add(board.id, 'conv-2');
      const c3 = await add(board.id, 'conv-3'); // conv-3, conv-2, conv-1

      await move(board.id, c1.id, novos.id, null); // para o topo
      expect((await layout(board.id))[0]).toEqual(['conv-1', 'conv-3', 'conv-2']);
      await move(board.id, c2.id, novos.id, c1.id); // logo abaixo do conv-1
      expect((await layout(board.id))[0]).toEqual(['conv-1', 'conv-2', 'conv-3']);

      await move(board.id, c3.id, atendimento.id, null);
      await move(board.id, c1.id, atendimento.id, c3.id);
      expect(await layout(board.id)).toEqual([['conv-2'], ['conv-3', 'conv-1'], []]);
      expect(events.published.at(-1)).toMatchObject({
        eventName: BoardCardEnteredColumnEvent.eventName,
        columnId: atendimento.id,
        previousColumnId: novos.id,
        movedBy: 'agent-1',
      });
    });

    it('refuses a neighbour from another column, other boards and hidden conversations', async () => {
      const board = await create();
      const [novos, atendimento] = board.columns;
      const c1 = await add(board.id, 'conv-1');
      const c2 = await add(board.id, 'conv-2');
      await expect(move(board.id, c1.id, atendimento.id, c2.id)).rejects.toThrow(CardNotFoundError);
      await expect(move(board.id, c1.id, novos.id, c1.id)).rejects.toThrow(CardNotFoundError);

      const other = await create('Outro');
      await expect(move(other.id, c1.id, other.firstColumn.id, null)).rejects.toThrow(
        CardNotFoundError,
      );
      conversations.hidden.add('conv-2');
      await expect(move(board.id, c2.id, novos.id, null)).rejects.toThrow(CardNotFoundError);
      await expect(
        new RemoveCardUseCase(cards, conversations, events, uow).execute({
          boardId: board.id,
          cardId: c2.id,
        }),
      ).rejects.toThrow(CardNotFoundError);
    });

    it('renumbers the column when neighbours get too close', async () => {
      const board = await create();
      const col = board.firstColumn.id;
      const c1 = await add(board.id, 'conv-1');
      const c2 = await add(board.id, 'conv-2');
      const c3 = await add(board.id, 'conv-3');
      // Força vizinhos colados: conv-3 em 0, conv-2 em 0 + 1e-9.
      for (const [card, position] of [
        [c3, 0],
        [c2, 1e-9],
        [c1, 5],
      ] as const) {
        card.moveTo(col, position, null);
        await cards.save(card);
      }
      await move(board.id, c1.id, col, c3.id);
      expect((await layout(board.id))[0]).toEqual(['conv-3', 'conv-1', 'conv-2']);
    });

    it('lists only visible conversations, page by page', async () => {
      const board = await create();
      for (let i = 1; i <= 7; i++) await add(board.id, `conv-${i}`); // 7..1
      conversations.hidden.add('conv-6');
      conversations.hidden.add('conv-5');
      conversations.hidden.add('conv-2');
      const col = board.firstColumn.id;

      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const [page] = await list(board.id, { columnId: col, cursor, limit: 2 });
        seen.push(...page.cards.map((c) => c.conversation.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);

      expect(seen).toEqual(['conv-7', 'conv-4', 'conv-3', 'conv-1']);
    });

    it('removes a card and lists where a conversation is', async () => {
      const board = await create();
      const other = await create('Pós-venda', ['Onboarding']);
      const card = await add(board.id, 'conv-1');
      await add(other.id, 'conv-1');
      const placements = new ListConversationPlacementsUseCase(reader(), cards, conversations);

      expect(
        (await placements.execute('conv-1')).map((p) => [p.board.name, p.column.name]),
      ).toEqual([
        ['Vendas', 'Novos'],
        ['Pós-venda', 'Onboarding'],
      ]);

      await new RemoveCardUseCase(cards, conversations, events, uow).execute({
        boardId: board.id,
        cardId: card.id,
      });
      expect((await placements.execute('conv-1')).map((p) => p.board.name)).toEqual(['Pós-venda']);

      conversations.hidden.add('conv-1');
      await expect(placements.execute('conv-1')).rejects.toThrow(BoardConversationNotFoundError);
    });
  });

  describe('automatic entry', () => {
    const started = (conversationId: string, teamId: string | null) =>
      new KanbanAutoAddHandler(boards, cards, ids, events, uow).handle(
        delivered(new ConversationStartedEvent(conversationId, 'tenant-a', 'ch-1', 'c-1', teamId)),
      );

    it('new conversations enter the boards that accept them, once', async () => {
      const all = await create('Todas');
      const sales = await create('Vendas');
      const manual = await create('Manual');
      await update(all.id, { autoAdd: { mode: 'all' } });
      await update(sales.id, { autoAdd: { mode: 'team', teamId: 'team-sales' } });

      await started('conv-1', 'team-sales');
      await started('conv-1', 'team-sales'); // evento repetido
      await started('conv-2', null);

      expect(await layout(all.id)).toEqual([['conv-2', 'conv-1'], [], []]);
      expect(await layout(sales.id)).toEqual([['conv-1'], [], []]);
      expect(await layout(manual.id)).toEqual([[], [], []]);
      expect(events.published.at(-1)).toMatchObject({ movedBy: null });
    });

    it('a deleted team stops feeding its boards', async () => {
      const sales = await create('Vendas');
      await update(sales.id, { autoAdd: { mode: 'team', teamId: 'team-sales' } });
      await new KanbanTeamCleanupHandler(boards).handle(
        delivered(new TeamDeletedEvent('team-sales', 'tenant-a')),
      );
      expect((await reader().get(sales.id)).autoAdd).toEqual({ mode: 'none' });
    });
  });

  it('tells every member with a conversation scope that the board changed', async () => {
    const notifier = new RecordingRealtimeNotifier();
    const board = await create();
    await new KanbanRealtimeHandler(notifier).onBoard(delivered(events.published[0]));
    expect(notifier.emitted).toEqual([
      {
        rooms: [
          'tenant:tenant-a:perm:conversations:view:all',
          'tenant:tenant-a:perm:conversations:view:own',
          'tenant:tenant-a:perm:conversations:view:team',
        ],
        event: BOARD_CHANGED,
        data: { boardId: board.id },
      },
    ]);
  });
});
