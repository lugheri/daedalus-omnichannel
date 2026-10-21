import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  InMemoryActorContext,
  RecordingEventBus,
  RecordingRealtimeNotifier,
  SequentialIdGenerator,
} from '../../../shared/testing/fakes';
import { TenantCreatedEvent } from '../../accounts';
import { LeadCapturedEvent } from '../../contacts';
import { ConversationStartedEvent } from '../../conversations';
import { FormSubmittedEvent } from '../../forms';
import { TeamDeletedEvent } from '../../teams';
import { BoardConversationNotFoundError } from '../domain/errors/board-conversation-not-found.error';
import { BoardNameTakenError } from '../domain/errors/board-name-taken.error';
import { BoardNotFoundError } from '../domain/errors/board-not-found.error';
import { ColumnNotEmptyError } from '../domain/errors/column-not-empty.error';
import { ColumnNotFoundError } from '../domain/errors/column-not-found.error';
import { DealNotFoundError } from '../domain/errors/deal-not-found.error';
import { InvalidBoardTeamError } from '../domain/errors/invalid-board-team.error';
import { DealEnteredColumnEvent } from '../domain/events/kanban-events';
import {
  FakeContactDirectory,
  FakeConversationDirectory,
  FakeDealAccess,
  FakeMemberDirectory,
  FakeTeamDirectory,
  InMemoryAutomationRuleRepository,
  InMemoryBoardRepository,
  InMemoryDealRepository,
} from '../testing/fakes';
import {
  DealEntry,
  KanbanConversationEntryHandler,
  KanbanDefaultBoardHandler,
  KanbanFormEntryHandler,
  KanbanLeadEntryHandler,
} from './event-handlers/kanban-auto-add.handler';
import { BOARD_CHANGED, KanbanRealtimeHandler } from './event-handlers/kanban-realtime.handler';
import { KanbanTeamCleanupHandler } from './event-handlers/kanban-team-cleanup.handler';
import {
  AddColumnUseCase,
  BoardsReader,
  CreateBoardUseCase,
  CreateDefaultBoardUseCase,
  DeleteBoardUseCase,
  DeleteColumnUseCase,
  UpdateBoardUseCase,
  UpdateColumnUseCase,
} from './use-cases/boards.use-cases';
import {
  CreateDealUseCase,
  DealVisibility,
  DeleteDealUseCase,
  ListBoardDealsUseCase,
  ListContactDealsUseCase,
  ListConversationDealsUseCase,
  MoveDealUseCase,
  SetDealStatusUseCase,
  UpdateDealUseCase,
  type CreateDealInput,
} from './use-cases/deals.use-cases';

/** Como o evento chega ao handler (dados + id da entrega). */
const delivered = <E extends object>(event: E) => ({ ...event, eventId: 'evt-1' }) as never;

describe('Kanban (sales pipelines)', () => {
  let tenant: FakeTenantContext;
  let deals: InMemoryDealRepository;
  let boards: InMemoryBoardRepository;
  let conversations: FakeConversationDirectory;
  let contacts: FakeContactDirectory;
  let access: FakeDealAccess;
  let actors: InMemoryActorContext;
  let events: RecordingEventBus;
  let ids: SequentialIdGenerator;
  const uow = new ImmediateUnitOfWork();
  const teams = new FakeTeamDirectory(['team-sales']);
  const members = new FakeMemberDirectory(['agent-2']);

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    deals = new InMemoryDealRepository(tenant);
    boards = new InMemoryBoardRepository(tenant, deals);
    conversations = new FakeConversationDirectory();
    contacts = new FakeContactDirectory();
    // A conversa "conv-x" é do contato "contact-conv-x".
    for (let i = 1; i <= 7; i++) contacts.add(`contact-conv-${i}`, `Cliente ${i}`);
    contacts.add('lead-1', 'Ana Lead');
    access = new FakeDealAccess();
    actors = new InMemoryActorContext();
    actors.authenticate({
      userId: 'u-1',
      tenantId: 'tenant-a',
      membershipId: 'me',
      sessionId: 's',
    });
    events = new RecordingEventBus();
    ids = new SequentialIdGenerator();
  });

  const reader = () => new BoardsReader(boards);
  const visibility = () => new DealVisibility(access, conversations, contacts);
  const create = (name = 'Vendas', columns?: string[]) =>
    new CreateBoardUseCase(boards, events, uow, tenant, ids).execute({ name, columns });
  const update = (id: string, input: Parameters<UpdateBoardUseCase['execute']>[1]) =>
    new UpdateBoardUseCase(boards, events, uow, teams).execute(id, input);
  const open = (boardId: string, input: Omit<CreateDealInput, 'boardId'>) =>
    new CreateDealUseCase(
      reader(),
      deals,
      contacts,
      conversations,
      members,
      actors,
      tenant,
      ids,
      events,
      uow,
    ).execute({ boardId, ...input });
  /** Negócio da conversa "conv-i", com título "D-i". */
  const add = (boardId: string, i: number, columnId?: string) =>
    open(boardId, { conversationId: `conv-${i}`, title: `D-${i}`, columnId });
  const move = (dealId: string, columnId: string, afterDealId: string | null) =>
    new MoveDealUseCase(reader(), deals, visibility(), actors, events, uow).execute({
      dealId,
      columnId,
      afterDealId,
    });
  const setStatus = (dealId: string, input: Parameters<SetDealStatusUseCase['execute']>[1]) =>
    new SetDealStatusUseCase(deals, visibility(), actors, events, uow).execute(dealId, input);
  const dealUpdate = (dealId: string, input: Parameters<UpdateDealUseCase['execute']>[1]) =>
    new UpdateDealUseCase(deals, visibility(), conversations, members, events, uow).execute(
      dealId,
      input,
    );
  const list = (
    boardId: string,
    input: { columnId?: string; cursor?: string; limit?: number } = {},
  ) =>
    new ListBoardDealsUseCase(reader(), deals, visibility()).execute(boardId, {
      limit: 50,
      ...input,
    });
  /** Títulos de cada etapa, de cima para baixo. */
  const layout = async (boardId: string) =>
    (await list(boardId)).map((column) => column.deals.map((v) => v.deal.title));
  const removeColumn = (boardId: string, columnId: string, moveTo?: string) =>
    new DeleteColumnUseCase(
      boards,
      events,
      uow,
      deals,
      new InMemoryAutomationRuleRepository(tenant),
    ).execute(boardId, columnId, moveTo);

  describe('pipelines', () => {
    it('a new pipeline comes with the default stages', async () => {
      const board = await create();
      expect(board.columns.map((c) => c.name)).toEqual([
        'Novo',
        'Em contato',
        'Proposta',
        'Fechamento',
      ]);
      expect(board.autoAddLeads).toBe(false);
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

    it('automatic entry: conversations (by team needs an existing team) and site leads', async () => {
      const board = await create();
      await expect(
        update(board.id, { autoAdd: { mode: 'team', teamId: 'ghost' } }),
      ).rejects.toThrow(InvalidBoardTeamError);
      const updated = await update(board.id, {
        autoAdd: { mode: 'team', teamId: 'team-sales' },
        autoAddLeads: true,
      });
      expect(updated.autoAdd).toEqual({ mode: 'team', teamId: 'team-sales' });
      expect(updated.autoAddLeads).toBe(true);
    });

    it('adds, renames and moves stages', async () => {
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

    it('deleting a stage with deals (closed ones too) needs a destination; they go to its end', async () => {
      const board = await create('Vendas', ['A', 'B']);
      const [a, b] = board.columns;
      const d1 = await add(board.id, 1, a.id);
      await add(board.id, 2, a.id); // topo: D-2, D-1
      await add(board.id, 3, b.id);
      await setStatus(d1.id, { status: 'won' }); // fechado, mas ainda "mora" na etapa A

      await expect(removeColumn(board.id, a.id)).rejects.toThrow(ColumnNotEmptyError);
      await expect(removeColumn(board.id, a.id, a.id)).rejects.toThrow(ColumnNotEmptyError);
      const updated = await removeColumn(board.id, a.id, b.id);

      expect(updated.columns.map((c) => c.name)).toEqual(['B']);
      expect(await layout(board.id)).toEqual([['D-3', 'D-2']]);
      expect((await deals.findById(d1.id))?.columnId).toBe(b.id);
      // Em massa: nenhuma automação de entrada disparada.
      expect(
        events.published.filter((e) => e instanceof DealEnteredColumnEvent && e.columnId === b.id),
      ).toHaveLength(1);
    });

    it('an empty stage is deleted without destination; the last one stays', async () => {
      const board = await create('Vendas', ['A', 'B']);
      await removeColumn(board.id, board.columns[0].id);
      await expect(removeColumn(board.id, board.columns[1].id)).rejects.toMatchObject({
        code: 'BOARD_NEEDS_COLUMN',
      });
    });

    it('deleting the pipeline takes its deals', async () => {
      const board = await create();
      await add(board.id, 1);
      await new DeleteBoardUseCase(boards, events, uow).execute(board.id);
      expect(deals.items).toHaveLength(0);
      await expect(reader().get(board.id)).rejects.toThrow(BoardNotFoundError);
    });

    it('a new account gets the default pipeline, once, only if it has none', async () => {
      const handler = new KanbanDefaultBoardHandler(
        new CreateDefaultBoardUseCase(boards, events, uow, tenant, ids),
      );
      await handler.handle();
      await handler.handle(); // evento repetido
      const [board, ...rest] = await reader().list();
      expect(rest).toEqual([]);
      expect(board).toMatchObject({
        name: 'Funil de vendas',
        autoAdd: { mode: 'all' },
        autoAddLeads: true,
      });
      expect(board.columns).toHaveLength(4);

      tenant.switchTo('tenant-b');
      await create('Meu funil');
      await handler.handle();
      expect((await reader().list()).map((b) => b.name)).toEqual(['Meu funil']);
      void TenantCreatedEvent; // o handler reage a este evento
    });
  });

  describe('deals', () => {
    it('opens from a conversation: its contact, me as owner, contact name as title', async () => {
      const board = await create();
      const deal = await open(board.id, { conversationId: 'conv-1' });

      expect(deal).toMatchObject({
        contactId: 'contact-conv-1',
        conversationId: 'conv-1',
        ownerId: 'me',
        title: 'Cliente 1',
        columnId: board.firstColumn.id,
        status: 'open',
      });
      expect(events.published.at(-1)).toMatchObject({
        eventName: DealEnteredColumnEvent.eventName,
        aggregateId: deal.id,
        previousColumnId: null,
        movedBy: 'me',
      });
    });

    it('opens from a contact, with value and owner; a contact can have several deals', async () => {
      const board = await create();
      const first = await open(board.id, {
        contactId: 'lead-1',
        title: 'Kit completo',
        valueCents: 150_000,
        ownerId: 'agent-2',
      });
      const second = await open(board.id, { contactId: 'lead-1', ownerId: null });

      expect(first).toMatchObject({
        valueCents: 150_000,
        ownerId: 'agent-2',
        conversationId: null,
      });
      expect(second).toMatchObject({ title: 'Ana Lead', ownerId: null });
      expect(await layout(board.id)).toEqual([['Ana Lead', 'Kit completo'], [], [], []]);
    });

    it('refuses an unknown contact, hidden or foreign conversation, inactive owner, foreign stage', async () => {
      const board = await create();
      const other = await create('Outro');
      conversations.hidden.add('conv-9');

      await expect(open(board.id, { contactId: 'ghost' })).rejects.toMatchObject({
        code: 'DEAL_CONTACT_NOT_FOUND',
      });
      await expect(open(board.id, { conversationId: 'conv-9' })).rejects.toThrow(
        BoardConversationNotFoundError,
      );
      await expect(
        open(board.id, { conversationId: 'conv-1', contactId: 'lead-1' }),
      ).rejects.toMatchObject({ code: 'DEAL_CONTACT_NOT_FOUND' });
      await expect(open(board.id, { contactId: 'lead-1', ownerId: 'gone' })).rejects.toMatchObject({
        code: 'DEAL_INVALID_OWNER',
      });
      await expect(
        open(board.id, { contactId: 'lead-1', columnId: other.firstColumn.id }),
      ).rejects.toThrow(ColumnNotFoundError);
    });

    it('moves within and across stages, reporting the entry', async () => {
      const board = await create();
      const [novo, contato] = board.columns;
      const d1 = await add(board.id, 1);
      const d2 = await add(board.id, 2);
      const d3 = await add(board.id, 3); // D-3, D-2, D-1

      await move(d1.id, novo.id, null); // para o topo
      expect((await layout(board.id))[0]).toEqual(['D-1', 'D-3', 'D-2']);
      await move(d2.id, novo.id, d1.id); // logo abaixo do D-1
      expect((await layout(board.id))[0]).toEqual(['D-1', 'D-2', 'D-3']);

      await move(d3.id, contato.id, null);
      await move(d1.id, contato.id, d3.id);
      expect(await layout(board.id)).toEqual([['D-2'], ['D-3', 'D-1'], [], []]);
      expect(events.published.at(-1)).toMatchObject({
        eventName: DealEnteredColumnEvent.eventName,
        columnId: contato.id,
        previousColumnId: novo.id,
        movedBy: 'me',
      });
    });

    it('refuses a neighbour from another stage, a stage of another pipeline and itself', async () => {
      const board = await create();
      const other = await create('Outro');
      const [novo, contato] = board.columns;
      const d1 = await add(board.id, 1);
      const d2 = await add(board.id, 2);
      await expect(move(d1.id, contato.id, d2.id)).rejects.toThrow(DealNotFoundError);
      await expect(move(d1.id, novo.id, d1.id)).rejects.toThrow(DealNotFoundError);
      await expect(move(d1.id, other.firstColumn.id, null)).rejects.toThrow(ColumnNotFoundError);
    });

    it('renumbers the stage when neighbours get too close', async () => {
      const board = await create();
      const col = board.firstColumn.id;
      const d1 = await add(board.id, 1);
      const d2 = await add(board.id, 2);
      const d3 = await add(board.id, 3);
      // Força vizinhos colados: D-3 em 0, D-2 em 0 + 1e-9.
      for (const [deal, position] of [
        [d3, 0],
        [d2, 1e-9],
        [d1, 5],
      ] as const) {
        deal.moveTo(col, position, null);
        await deals.save(deal);
      }
      await move(d1.id, col, d3.id);
      expect((await layout(board.id))[0]).toEqual(['D-3', 'D-1', 'D-2']);
    });

    it('an agent sees own deals, unowned ones and those of conversations they see', async () => {
      const board = await create();
      const mine = await open(board.id, { contactId: 'lead-1', title: 'Meu' });
      await open(board.id, { contactId: 'lead-1', title: 'Fila', ownerId: null });
      await open(board.id, { contactId: 'lead-1', title: 'Da Bia', ownerId: 'agent-2' });
      await open(board.id, {
        conversationId: 'conv-1',
        title: 'Conversa visível',
        ownerId: 'agent-2',
      });
      const hidden = await open(board.id, {
        conversationId: 'conv-2',
        title: 'Conversa oculta',
        ownerId: 'agent-2',
      });
      conversations.hidden.add('conv-2');

      access.viewer = { membershipId: 'me', seesAll: false };
      expect((await layout(board.id))[0].sort()).toEqual(['Conversa visível', 'Fila', 'Meu']);
      await expect(move(hidden.id, board.firstColumn.id, null)).rejects.toThrow(DealNotFoundError);
      await expect(move(mine.id, board.firstColumn.id, null)).resolves.toBeDefined();

      // Supervisão vê tudo, mas a conversa oculta não acompanha o negócio.
      access.viewer = { membershipId: 'me', seesAll: true };
      const [column] = await list(board.id);
      expect(column.deals).toHaveLength(5);
      expect(column.deals.find((v) => v.deal.id === hidden.id)?.conversation).toBeNull();
      expect(column.deals.find((v) => v.deal.id === mine.id)?.contact?.name).toBe('Ana Lead');
    });

    it('lists only visible deals, page by page', async () => {
      const board = await create();
      for (let i = 1; i <= 7; i++) {
        await open(board.id, { conversationId: `conv-${i}`, title: `D-${i}`, ownerId: 'agent-2' });
      }
      for (const i of [6, 5, 2]) conversations.hidden.add(`conv-${i}`);
      access.viewer = { membershipId: 'me', seesAll: false };

      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const [page] = await list(board.id, { columnId: board.firstColumn.id, cursor, limit: 2 });
        seen.push(...page.deals.map((v) => v.deal.title));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);

      expect(seen).toEqual(['D-7', 'D-4', 'D-3', 'D-1']);
    });

    it('edits title, value and owner; links a conversation of the same contact only', async () => {
      const board = await create();
      const deal = await open(board.id, { contactId: 'contact-conv-1', title: 'Proposta' });

      const edited = await dealUpdate(deal.id, {
        title: 'Proposta v2',
        valueCents: 99_00,
        ownerId: null,
      });
      expect(edited).toMatchObject({ title: 'Proposta v2', valueCents: 9900, ownerId: null });

      await expect(dealUpdate(deal.id, { conversationId: 'conv-2' })).rejects.toThrow(
        BoardConversationNotFoundError,
      );
      await expect(dealUpdate(deal.id, { ownerId: 'gone' })).rejects.toMatchObject({
        code: 'DEAL_INVALID_OWNER',
      });
      expect(await dealUpdate(deal.id, { conversationId: 'conv-1' })).toMatchObject({
        conversationId: 'conv-1',
      });
    });

    it('won and lost leave the pipeline (still on the contact), and can be reopened', async () => {
      const board = await create();
      const won = await open(board.id, { contactId: 'lead-1', title: 'Ganho', valueCents: 500 });
      const lost = await open(board.id, { contactId: 'lead-1', title: 'Perdido' });
      await open(board.id, { contactId: 'lead-1', title: 'Aberto' });

      await setStatus(won.id, { status: 'won' });
      await setStatus(lost.id, { status: 'lost', lostReason: 'Sem orçamento' });
      expect((await layout(board.id))[0]).toEqual(['Aberto']);
      await expect(move(won.id, board.columns[1].id, null)).rejects.toMatchObject({
        code: 'DEAL_NOT_OPEN',
      });

      const onContact = await new ListContactDealsUseCase(reader(), deals, visibility()).execute(
        'lead-1',
      );
      expect(onContact.map((p) => [p.deal.title, p.deal.status, p.column.name])).toEqual([
        ['Aberto', 'open', 'Novo'],
        ['Perdido', 'lost', 'Novo'],
        ['Ganho', 'won', 'Novo'],
      ]);
      expect(onContact[1].deal.lostReason).toBe('Sem orçamento');

      await setStatus(lost.id, { status: 'open' });
      expect((await layout(board.id))[0].sort()).toEqual(['Aberto', 'Perdido']);
    });

    it('deletes a deal; lists the open deals of a conversation', async () => {
      const board = await create();
      const other = await create('Pós-venda', ['Onboarding']);
      const deal = await add(board.id, 1);
      await add(other.id, 1);
      const byConversation = new ListConversationDealsUseCase(
        reader(),
        deals,
        visibility(),
        conversations,
      );

      expect(
        (await byConversation.execute('conv-1')).map((p) => [p.board.name, p.column.name]),
      ).toEqual([
        ['Vendas', 'Novo'],
        ['Pós-venda', 'Onboarding'],
      ]);

      await new DeleteDealUseCase(deals, visibility(), events, uow).execute(deal.id);
      expect((await byConversation.execute('conv-1')).map((p) => p.board.name)).toEqual([
        'Pós-venda',
      ]);

      conversations.hidden.add('conv-1');
      await expect(byConversation.execute('conv-1')).rejects.toThrow(
        BoardConversationNotFoundError,
      );
    });

    it('another account does not see them', async () => {
      const board = await create();
      const deal = await add(board.id, 1);
      tenant.switchTo('tenant-b');
      await expect(setStatus(deal.id, { status: 'won' })).rejects.toThrow(DealNotFoundError);
    });
  });

  describe('automatic entry', () => {
    const entry = () => new DealEntry(deals, contacts, ids, events, uow);
    const started = (i: number, teamId: string | null) =>
      new KanbanConversationEntryHandler(boards, entry()).handle(
        delivered(
          new ConversationStartedEvent(
            `conv-${i}`,
            'tenant-a',
            'ch-1',
            `contact-conv-${i}`,
            teamId,
          ),
        ),
      );
    const lead = (contactId: string) =>
      new KanbanLeadEntryHandler(boards, entry()).handle(
        delivered(new LeadCapturedEvent(contactId, 'tenant-a', 'Feira', true)),
      );

    it('new conversations enter the pipelines that accept them, once, with no owner', async () => {
      const all = await create('Todas');
      const sales = await create('Vendas');
      const manual = await create('Manual');
      await update(all.id, { autoAdd: { mode: 'all' } });
      await update(sales.id, { autoAdd: { mode: 'team', teamId: 'team-sales' } });

      await started(1, 'team-sales');
      await started(1, 'team-sales'); // evento repetido
      await started(2, null);

      expect((await layout(all.id))[0]).toEqual(['Cliente 2', 'Cliente 1']);
      expect((await layout(sales.id))[0]).toEqual(['Cliente 1']);
      expect((await layout(manual.id))[0]).toEqual([]);
      const [opened] = await deals.listOpenByConversation('conv-2');
      expect(opened).toMatchObject({ ownerId: null, conversationId: 'conv-2' });
      expect(events.published.at(-1)).toMatchObject({ movedBy: null });
    });

    it('a site form: contact form opens a plain deal; service request names it and takes the price', async () => {
      const board = await create();
      await update(board.id, { autoAddLeads: true });
      contacts.add('lead-2', 'Bia');
      const submitted = (contactId: string, service: FormSubmittedEvent['service']) =>
        new KanbanFormEntryHandler(boards, entry()).handle(
          delivered(
            new FormSubmittedEvent(
              'sub-1',
              'tenant-a',
              'form-1',
              service ? 'service' : 'contact',
              contactId,
              service,
            ),
          ),
        );

      await submitted('lead-1', null);
      await submitted('lead-2', { id: 'svc', name: 'Corte', priceCents: 5000 });
      await submitted('lead-2', { id: 'svc', name: 'Barba', priceCents: 3000 }); // já tem em aberto

      const [first] = await list(board.id);
      expect(first.deals.map((v) => [v.deal.title, v.deal.valueCents, v.deal.ownerId])).toEqual([
        ['Corte — Bia', 5000, null],
        ['Ana Lead', null, null],
      ]);
    });

    it('site leads enter the pipelines that accept leads, while the contact has no open deal', async () => {
      const board = await create();
      await create('Sem leads');
      await update(board.id, { autoAddLeads: true });

      await lead('lead-1');
      await lead('lead-1'); // o mesmo contato enviou de novo: já tem negócio em aberto
      expect((await layout(board.id))[0]).toEqual(['Ana Lead']);

      const [deal] = await deals.listByContact('lead-1');
      await setStatus(deal.id, { status: 'won' });
      await lead('lead-1'); // nova oportunidade depois de fechar
      expect((await layout(board.id))[0]).toEqual(['Ana Lead']);
      expect(await deals.listByContact('lead-1')).toHaveLength(2);
    });

    it('a lead that later starts a conversation gets it linked to the open deal', async () => {
      const board = await create();
      await update(board.id, { autoAdd: { mode: 'all' }, autoAddLeads: true });
      contacts.add('contact-conv-5', 'Lead do site');

      await lead('contact-conv-5');
      await started(5, null);

      const all = await deals.listByContact('contact-conv-5');
      expect(all).toHaveLength(1);
      expect(all[0].conversationId).toBe('conv-5');
    });

    it('two events of the same contact at once open ONE deal; the loser links its conversation', async () => {
      const board = await create();
      await update(board.id, { autoAdd: { mode: 'all' }, autoAddLeads: true });
      contacts.add('contact-conv-6', 'Lead e WhatsApp');
      await lead('contact-conv-6'); // o "vencedor" já gravou...
      // ...mas o perdedor leu "não tem negócio" antes do commit dele: a
      // primeira leitura vem vazia; a gravação esbarra no índice único
      // parcial (que o fake reproduz) e a releitura acha o negócio.
      const original = deals.findOpenOnBoard.bind(deals);
      let reads = 0;
      deals.findOpenOnBoard = (boardId, contactId) =>
        ++reads === 1 ? Promise.resolve(null) : original(boardId, contactId);

      await started(6, null);

      const all = await deals.listByContact('contact-conv-6');
      expect(all).toHaveLength(1);
      expect(all[0].conversationId).toBe('conv-6');
      expect(reads).toBe(2);
    });

    it('the unique guard covers only automatic entries: manual deals and reopening still work', async () => {
      const board = await create();
      await update(board.id, { autoAddLeads: true });
      await lead('lead-1');
      const [auto] = await deals.listByContact('lead-1');
      expect(auto.autoEntry).toBe(true);

      // À mão, o mesmo contato pode ter outro negócio em aberto no funil.
      const manual = await open(board.id, { contactId: 'lead-1', title: 'Upsell' });
      expect(manual.autoEntry).toBe(false);

      // Fecha o automático, entra um automático novo, e o antigo é reaberto:
      // reabrir tira a marca, então não colide com o novo.
      await setStatus(auto.id, { status: 'lost' });
      await lead('lead-1'); // o manual em aberto segura a entrada
      await setStatus(manual.id, { status: 'won' });
      await lead('lead-1');
      const reopened = await setStatus(auto.id, { status: 'open' });

      expect(reopened.autoEntry).toBe(false);
      expect((await deals.listByContact('lead-1')).filter((d) => d.isOpen)).toHaveLength(2);
    });

    it('a deleted team stops feeding its pipelines', async () => {
      const sales = await create('Vendas');
      await update(sales.id, { autoAdd: { mode: 'team', teamId: 'team-sales' } });
      await new KanbanTeamCleanupHandler(boards).handle(
        delivered(new TeamDeletedEvent('team-sales', 'tenant-a')),
      );
      expect((await reader().get(sales.id)).autoAdd).toEqual({ mode: 'none' });
    });
  });

  it('tells every member with a conversation scope that the pipeline changed', async () => {
    const notifier = new RecordingRealtimeNotifier();
    const handler = new KanbanRealtimeHandler(notifier);
    const board = await create();
    await handler.onBoard(delivered(events.published[0]));
    const deal = await open(board.id, { contactId: 'lead-1' });
    await handler.onEntered(delivered(events.published.at(-1)!));

    const rooms = [
      'tenant:tenant-a:perm:conversations:view:all',
      'tenant:tenant-a:perm:conversations:view:own',
      'tenant:tenant-a:perm:conversations:view:team',
    ];
    expect(notifier.emitted).toEqual([
      { rooms, event: BOARD_CHANGED, data: { boardId: board.id, contactId: undefined } },
      { rooms, event: BOARD_CHANGED, data: { boardId: board.id, contactId: 'lead-1' } },
    ]);
    expect(deal.contactId).toBe('lead-1');
  });
});
