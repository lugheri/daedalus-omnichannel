import type {
  EnqueueOptions,
  JobDefinition,
  JobQueue,
} from '../../../shared/application/job-queue';
import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  InMemoryActorContext,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../shared/testing/fakes';
import {
  ConversationDispositionSetEvent,
  ConversationMessageAddedEvent,
  ConversationStatusChangedEvent,
} from '../../conversations';
import { DomainError } from '../../../shared/domain/domain-error';
import type { AutomationAction, AutomationTrigger } from '../domain/automation-rule.entity';
import { BoardCard } from '../domain/board-card.entity';
import type { Board } from '../domain/board.entity';
import { AutomationNotFoundError } from '../domain/errors/automation-not-found.error';
import { ColumnNotFoundError } from '../domain/errors/column-not-found.error';
import { BoardCardEnteredColumnEvent } from '../domain/events/kanban-events';
import {
  FakeConversationActions,
  FakeConversationDirectory,
  FakeMemberDirectory,
  FakeTeamDirectory,
  InMemoryAutomationRuleRepository,
  InMemoryAutomationRunRepository,
  InMemoryBoardCardRepository,
  InMemoryBoardRepository,
} from '../testing/fakes';
import {
  AutomationReferences,
  CreateAutomationUseCase,
  DeleteAutomationUseCase,
  ListAutomationRunsUseCase,
  UpdateAutomationUseCase,
} from './automations/automation-rules.use-cases';
import { AutomationRunner } from './automations/automation-runner';
import { KanbanAutomationTriggersHandler } from './automations/automation-triggers.handler';
import { IdleRuleJob, IdleSweepUseCase, RunIdleRuleUseCase } from './automations/idle-automations';
import {
  BoardsReader,
  CreateBoardUseCase,
  DeleteColumnUseCase,
} from './use-cases/boards.use-cases';
import { AddCardUseCase, MoveCardUseCase } from './use-cases/cards.use-cases';

const delivered = <E extends object>(event: E, eventId = 'evt-1') =>
  ({ ...event, eventId }) as never;

/** Guarda também o tenant de cada job (o processor o restaura no worker). */
class TenantRecordingJobQueue implements JobQueue {
  readonly jobs: { name: string; payload: unknown; tenantId: string; options?: EnqueueOptions }[] =
    [];
  constructor(private readonly tenant: FakeTenantContext) {}
  add<T>(job: JobDefinition<T>, payload: T, options?: EnqueueOptions): Promise<void> {
    this.jobs.push({ name: job.name, payload, tenantId: this.tenant.tenantId, options });
    return Promise.resolve();
  }
}

const minutes = (n: number) => new Date(Date.now() + n * 60_000);

/** Como o canal responde quando está desconectado (o runner guarda o código). */
class ChannelDown extends DomainError {
  readonly code = 'CHANNEL_NOT_CONNECTED';
  constructor() {
    super('Channel not connected');
  }
}

describe('Automations', () => {
  let tenant: FakeTenantContext;
  let boards: InMemoryBoardRepository;
  let cards: InMemoryBoardCardRepository;
  let rules: InMemoryAutomationRuleRepository;
  let runs: InMemoryAutomationRunRepository;
  let actions: FakeConversationActions;
  let events: RecordingEventBus;
  let ids: SequentialIdGenerator;
  let actors: InMemoryActorContext;
  let runner: AutomationRunner;
  let triggers: KanbanAutomationTriggersHandler;
  const uow = new ImmediateUnitOfWork();
  const conversations = new FakeConversationDirectory();
  let board: Board;

  beforeEach(async () => {
    tenant = new FakeTenantContext('tenant-a');
    cards = new InMemoryBoardCardRepository(tenant);
    boards = new InMemoryBoardRepository(tenant, cards);
    rules = new InMemoryAutomationRuleRepository(tenant);
    runs = new InMemoryAutomationRunRepository(tenant, cards);
    actions = new FakeConversationActions();
    actions.dispositions.add('disp-sale');
    events = new RecordingEventBus();
    ids = new SequentialIdGenerator();
    actors = new InMemoryActorContext();
    actors.authenticate({
      userId: 'u',
      tenantId: 'tenant-a',
      membershipId: 'agent-1',
      sessionId: 's',
    });
    runner = new AutomationRunner(runs, cards, actions, ids, events, uow);
    triggers = new KanbanAutomationTriggersHandler(rules, cards, boards, runner);
    board = await new CreateBoardUseCase(boards, events, uow, tenant, ids).execute({
      name: 'Vendas',
      columns: ['Lead', 'Proposta', 'Ganho', 'Sem retorno'],
    });
  });

  const col = (name: string) => board.columns.find((c) => c.name === name)!.id;
  const references = () =>
    new AutomationReferences(
      new FakeTeamDirectory(['team-sales']),
      new FakeMemberDirectory(['agent-9']),
      actions,
    );
  const create = (
    column: string,
    trigger: AutomationTrigger,
    ruleActions: AutomationAction[] = [],
  ) =>
    new CreateAutomationUseCase(new BoardsReader(boards), references(), rules, tenant, ids).execute(
      board.id,
      { columnId: col(column), trigger, actions: ruleActions },
    );
  const reader = () => new BoardsReader(boards);
  const addCard = (conversationId: string, column = 'Lead') =>
    new AddCardUseCase(reader(), cards, conversations, actors, tenant, ids, events, uow).execute({
      boardId: board.id,
      conversationId,
      columnId: col(column),
    });
  const moveCard = (cardId: string, column: string) =>
    new MoveCardUseCase(reader(), cards, conversations, actors, events, uow).execute({
      boardId: board.id,
      cardId,
      columnId: col(column),
      afterCardId: null,
    });
  /** Entrega ao handler os eventos de entrada publicados até agora (como o worker faria). */
  const deliverEntries = async () => {
    const entries = events.published.filter((e) => e instanceof BoardCardEnteredColumnEvent);
    events.published.length = 0;
    for (const [i, e] of entries.entries())
      await triggers.onCardEntered(delivered(e, `entry-${ids.generate()}-${i}`));
  };
  const columnOf = (cardId: string) =>
    board.columns.find((c) => c.id === cards.items.find((x) => x.id === cardId)!.columnId)!.name;

  describe('rules', () => {
    it('checks references: disposition, team, active person, destination column', async () => {
      const bad = (trigger: AutomationTrigger, ruleActions: AutomationAction[] = []) =>
        create('Lead', trigger, ruleActions);
      await expect(bad({ type: 'disposition_set', dispositionId: 'ghost' })).rejects.toMatchObject({
        code: 'AUTOMATION_INVALID_DISPOSITION',
      });
      await expect(
        bad({ type: 'card_entered' }, [{ type: 'assign', teamId: 'ghost' }]),
      ).rejects.toMatchObject({
        code: 'AUTOMATION_INVALID_TEAM',
      });
      await expect(
        bad({ type: 'card_entered' }, [{ type: 'assign', assigneeId: 'inactive' }]),
      ).rejects.toMatchObject({ code: 'AUTOMATION_INVALID_ASSIGNEE' });
      await expect(
        bad({ type: 'card_idle', minutes: 5 }, [{ type: 'move', columnId: 'other-board-column' }]),
      ).rejects.toMatchObject({ code: 'AUTOMATION_INVALID_MOVE' });
      await expect(
        new CreateAutomationUseCase(reader(), references(), rules, tenant, ids).execute(board.id, {
          columnId: 'nope',
          trigger: { type: 'customer_replied' },
          actions: [],
        }),
      ).rejects.toThrow(ColumnNotFoundError);
    });

    it('at most 10 rules per column', async () => {
      for (let i = 0; i < 10; i++) await create('Lead', { type: 'customer_replied' });
      await expect(create('Lead', { type: 'customer_replied' })).rejects.toMatchObject({
        code: 'AUTOMATION_TOO_MANY',
      });
    });

    it('a rule of another board does not exist here', async () => {
      const rule = await create('Lead', { type: 'customer_replied' });
      const other = await new CreateBoardUseCase(boards, events, uow, tenant, ids).execute({
        name: 'Outro',
      });
      await expect(
        new UpdateAutomationUseCase(reader(), references(), rules).execute(other.id, rule.id, {
          enabled: false,
        }),
      ).rejects.toThrow(AutomationNotFoundError);
      await expect(
        new DeleteAutomationUseCase(reader(), rules).execute(other.id, rule.id),
      ).rejects.toThrow(AutomationNotFoundError);
    });

    it('deleting a column takes its rules and the ones moving cards into it', async () => {
      await create('Lead', { type: 'customer_replied' });
      await create('Proposta', { type: 'card_idle', minutes: 5 }, [
        { type: 'move', columnId: col('Sem retorno') },
      ]);
      const kept = await create('Ganho', { type: 'conversation_resolved' });
      await new DeleteColumnUseCase(boards, events, uow, cards, rules).execute(
        board.id,
        col('Sem retorno'),
      );
      await new DeleteColumnUseCase(boards, events, uow, cards, rules).execute(
        board.id,
        col('Lead'),
      );
      expect(rules.items.map((r) => r.id)).toEqual([kept.id]);
    });
  });

  describe('when a card enters a column', () => {
    it('sends the message with the name and assigns — once per entry', async () => {
      await create('Proposta', { type: 'card_entered' }, [
        { type: 'send_message', text: 'Olá {{nome}}, segue a proposta!' },
        { type: 'assign', teamId: 'team-sales' },
      ]);
      actions.names.set('conv-1', 'Maria Souza');
      const card = await addCard('conv-1');
      await moveCard(card.id, 'Proposta');
      const [entry] = events.published.filter(
        (e) => e instanceof BoardCardEnteredColumnEvent && e.columnId === col('Proposta'),
      );

      await triggers.onCardEntered(delivered(entry, 'evt-9'));
      await triggers.onCardEntered(delivered(entry, 'evt-9')); // evento repetido

      expect(actions.sent).toEqual([
        { conversationId: 'conv-1', text: 'Olá Maria, segue a proposta!' },
      ]);
      expect(actions.assigned).toEqual([{ conversationId: 'conv-1', teamId: 'team-sales' }]);
      expect(runs.items).toHaveLength(1);
      expect(runs.items[0]).toMatchObject({ status: 'succeeded', cardId: card.id });
    });

    it('a failing action is recorded and does not stop the next one', async () => {
      const rule = await create('Lead', { type: 'card_entered' }, [
        { type: 'send_message', text: 'Oi' },
        { type: 'assign', assigneeId: 'agent-9' },
      ]);
      actions.failSend = new ChannelDown();

      await addCard('conv-1');
      await deliverEntries();

      expect(actions.assigned).toHaveLength(1);
      const [run] = await new ListAutomationRunsUseCase(reader(), rules, runs).execute(
        board.id,
        rule.id,
      );
      expect(run).toMatchObject({
        status: 'failed',
        results: [
          { type: 'send_message', ok: false, error: 'CHANNEL_NOT_CONNECTED' },
          { type: 'assign', ok: true },
        ],
      });
    });

    it('disabled rules do nothing', async () => {
      const rule = await create('Lead', { type: 'card_entered' }, [
        { type: 'send_message', text: 'Oi' },
      ]);
      await new UpdateAutomationUseCase(reader(), references(), rules).execute(board.id, rule.id, {
        enabled: false,
      });
      await addCard('conv-1');
      await deliverEntries();
      expect(actions.sent).toEqual([]);
    });
  });

  describe('conversation events move the card into the rule column', () => {
    it('by disposition, on every board the conversation is on (leftmost rule wins)', async () => {
      await create('Ganho', { type: 'disposition_set', dispositionId: 'disp-sale' });
      await create('Sem retorno', { type: 'disposition_set', dispositionId: 'disp-sale' });
      const card = await addCard('conv-1');
      events.published.length = 0;

      await triggers.onDisposition(
        delivered(
          new ConversationDispositionSetEvent('conv-1', 'tenant-a', 'disp-sale', null, 'agent-1'),
        ),
      );

      expect(columnOf(card.id)).toBe('Ganho');
      // Movido pelo sistema: dispara as regras de entrada da coluna nova.
      expect(events.published).toEqual([
        expect.objectContaining({ columnId: col('Ganho'), movedBy: null }),
      ]);
      // Outra tabulação: nada muda.
      await triggers.onDisposition(
        delivered(
          new ConversationDispositionSetEvent('conv-1', 'tenant-a', 'other', null, 'a'),
          'evt-2',
        ),
      );
      expect(columnOf(card.id)).toBe('Ganho');
    });

    it('when resolved, and when the customer replies (not on our own messages)', async () => {
      await create('Ganho', { type: 'conversation_resolved' });
      await create('Proposta', { type: 'customer_replied' });
      const card = await addCard('conv-1');

      await triggers.onMessage(
        delivered(new ConversationMessageAddedEvent('conv-1', 'tenant-a', 'm-1', 'outbound', null)),
      );
      expect(columnOf(card.id)).toBe('Lead');
      await triggers.onMessage(
        delivered(
          new ConversationMessageAddedEvent('conv-1', 'tenant-a', 'm-2', 'inbound', null),
          'evt-2',
        ),
      );
      expect(columnOf(card.id)).toBe('Proposta');

      await triggers.onStatus(
        delivered(
          new ConversationStatusChangedEvent('conv-1', 'tenant-a', 'pending', 'open'),
          'evt-3',
        ),
      );
      expect(columnOf(card.id)).toBe('Proposta');
      await triggers.onStatus(
        delivered(
          new ConversationStatusChangedEvent('conv-1', 'tenant-a', 'resolved', 'open'),
          'evt-4',
        ),
      );
      expect(columnOf(card.id)).toBe('Ganho');
    });
  });

  describe('time stuck in a column', () => {
    const runIdle = (ruleId: string, at: Date) =>
      new RunIdleRuleUseCase(rules, runs, runner).execute(ruleId, at);

    it('counts from when the rule was activated, fires once per entry, and moves', async () => {
      // O card entrou na coluna há 3 dias — mas a regra é nova: não dispara na hora.
      const card = await addCard('conv-1');
      await cards.save(
        BoardCard.restore(card.id, {
          tenantId: card.tenantId,
          boardId: card.boardId,
          columnId: card.columnId,
          conversationId: card.conversationId,
          position: card.position,
          enteredColumnAt: minutes(-3 * 24 * 60),
          createdAt: card.createdAt,
        }),
      );
      const rule = await create('Lead', { type: 'card_idle', minutes: 60 }, [
        { type: 'send_message', text: 'Ainda tem interesse, {{nome}}?' },
        { type: 'move', columnId: col('Sem retorno') },
      ]);

      await runIdle(rule.id, minutes(30));
      expect(actions.sent).toEqual([]);

      await runIdle(rule.id, minutes(61));
      await runIdle(rule.id, minutes(62)); // de novo: não repete
      expect(actions.sent).toEqual([{ conversationId: 'conv-1', text: 'Ainda tem interesse?' }]);
      expect(columnOf(card.id)).toBe('Sem retorno');
    });

    it('a card moved out meanwhile is not due; coming back counts again', async () => {
      const rule = await create('Lead', { type: 'card_idle', minutes: 60 }, [
        { type: 'send_message', text: 'Oi' },
      ]);
      const card = await addCard('conv-1');
      await moveCard(card.id, 'Proposta');
      await runIdle(rule.id, minutes(61));
      expect(actions.sent).toEqual([]);

      await moveCard(card.id, 'Lead');
      await runIdle(rule.id, minutes(61));
      expect(actions.sent).toHaveLength(1);
    });

    it('the sweep enqueues one job per rule, in its own tenant, once per minute', async () => {
      const a = await create('Lead', { type: 'card_idle', minutes: 5 }, [
        { type: 'send_message', text: 'Oi' },
      ]);
      tenant.switchTo('tenant-b');
      const otherBoard = await new CreateBoardUseCase(boards, events, uow, tenant, ids).execute({
        name: 'B',
      });
      const b = await new CreateAutomationUseCase(
        reader(),
        references(),
        rules,
        tenant,
        ids,
      ).execute(otherBoard.id, {
        columnId: otherBoard.firstColumn.id,
        trigger: { type: 'card_idle', minutes: 5 },
        actions: [{ type: 'send_message', text: 'Oi' }],
      });

      const jobs = new TenantRecordingJobQueue(tenant);
      const at = new Date('2030-01-01T10:00:30Z');
      await new IdleSweepUseCase(rules, tenant, jobs).execute(at);

      expect(jobs.jobs.map((j) => [j.name, j.payload, j.tenantId, j.options?.jobId])).toEqual([
        [
          IdleRuleJob.name,
          { ruleId: a.id },
          'tenant-a',
          `idle-rule:${a.id}:${Math.floor(at.getTime() / 60_000)}`,
        ],
        [
          IdleRuleJob.name,
          { ruleId: b.id },
          'tenant-b',
          `idle-rule:${b.id}:${Math.floor(at.getTime() / 60_000)}`,
        ],
      ]);
    });
  });
});
