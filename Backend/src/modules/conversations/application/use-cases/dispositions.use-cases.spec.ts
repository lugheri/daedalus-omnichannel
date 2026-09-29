import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { Conversation } from '../../domain/conversation.entity';
import { DispositionInUseError } from '../../domain/errors/disposition-in-use.error';
import { DispositionNameTakenError } from '../../domain/errors/disposition-name-taken.error';
import { DispositionNotFoundError } from '../../domain/errors/disposition-not-found.error';
import { DispositionRequiredError } from '../../domain/errors/disposition-required.error';
import { ConversationNotFoundError } from '../../domain/errors/conversation-not-found.error';
import { InvalidDispositionError } from '../../domain/errors/invalid-disposition.error';
import { InvalidDispositionNoteError } from '../../domain/errors/invalid-disposition-note.error';
import { ConversationDispositionSetEvent } from '../../domain/events/conversation-events';
import {
  FakeMemberAccess,
  InMemoryConversationDispositionRepository,
  InMemoryConversationRepository,
  InMemoryDispositionRepository,
} from '../../testing/fakes';
import { ConversationTabulator } from '../conversation-tabulator';
import { VisibleConversations } from '../visible-conversations';
import {
  CreateDispositionUseCase,
  DeleteDispositionUseCase,
  ListDispositionsUseCase,
  UpdateDispositionUseCase,
} from './dispositions/dispositions.use-cases';
import {
  ListConversationDispositionsUseCase,
  TabulateConversationUseCase,
} from './tabulate-conversation/tabulate-conversation.use-cases';
import { ChangeConversationStatusUseCase } from './update-conversation/update-conversation.use-cases';

describe('Dispositions (tabulações)', () => {
  let tenant: FakeTenantContext;
  let conversations: InMemoryConversationRepository;
  let history: InMemoryConversationDispositionRepository;
  let dispositions: InMemoryDispositionRepository;
  let access: FakeMemberAccess;
  let events: RecordingEventBus;
  let ids: SequentialIdGenerator;
  let visible: VisibleConversations;
  let tabulator: ConversationTabulator;
  const uow = new ImmediateUnitOfWork();

  beforeEach(async () => {
    tenant = new FakeTenantContext('tenant-a');
    conversations = new InMemoryConversationRepository(tenant);
    history = new InMemoryConversationDispositionRepository(tenant);
    dispositions = new InMemoryDispositionRepository(tenant, history);
    access = new FakeMemberAccess({
      membershipId: 'agent-1',
      permissions: ['conversations:view:own'],
      teamIds: [],
    });
    events = new RecordingEventBus();
    ids = new SequentialIdGenerator();
    visible = new VisibleConversations(conversations, access);
    tabulator = new ConversationTabulator(dispositions, history, ids);

    // Conversa na fila geral: o agente enxerga.
    await conversations.save(
      Conversation.start('conv-1', {
        tenantId: 'tenant-a',
        channelId: 'ch-1',
        contactId: 'c-1',
        teamId: null,
      }),
    );
  });

  const create = (name: string, color: 'green' | 'red' = 'green') =>
    new CreateDispositionUseCase(dispositions, tenant, ids).execute({ name, color });
  const update = (id: string, input: Parameters<UpdateDispositionUseCase['execute']>[1]) =>
    new UpdateDispositionUseCase(dispositions).execute(id, input);
  const remove = (id: string) => new DeleteDispositionUseCase(dispositions).execute(id);
  const tabulate = (dispositionId: string, note?: string, conversationId = 'conv-1') =>
    new TabulateConversationUseCase(conversations, events, uow, visible, tabulator).execute({
      conversationId,
      dispositionId,
      note,
    });
  const changeStatus = (
    status: 'open' | 'pending' | 'resolved',
    disposition?: { dispositionId: string; note?: string },
  ) =>
    new ChangeConversationStatusUseCase(conversations, events, uow, visible, tabulator).execute({
      conversationId: 'conv-1',
      status,
      disposition,
    });
  const conversation = async () => (await conversations.findById('conv-1'))!;

  describe('catalog', () => {
    it('creates with a tidy name and lists by name', async () => {
      await create('  Venda   realizada ');
      await create('Sem interesse', 'red');

      const list = await new ListDispositionsUseCase(dispositions).execute();
      expect(list.map((d) => [d.name, d.color])).toEqual([
        ['Sem interesse', 'red'],
        ['Venda realizada', 'green'],
      ]);
    });

    it('validates name and color', async () => {
      await expect(create('   ')).rejects.toThrow(InvalidDispositionError);
      await expect(create('x'.repeat(61))).rejects.toThrow(InvalidDispositionError);
      await expect(create('Ok', 'neon' as never)).rejects.toThrow(InvalidDispositionError);
    });

    it('names are unique in the account, ignoring case', async () => {
      const sale = await create('Venda realizada');
      const lost = await create('Perdido');
      await expect(create('VENDA REALIZADA')).rejects.toThrow(DispositionNameTakenError);
      await expect(update(lost.id, { name: 'venda realizada' })).rejects.toThrow(
        DispositionNameTakenError,
      );
      // Mudar só a caixa do próprio nome pode.
      expect((await update(sale.id, { name: 'Venda Realizada' })).name).toBe('Venda Realizada');

      tenant.switchTo('tenant-b');
      await expect(create('Venda realizada')).resolves.toBeDefined();
    });

    it('archives and brings back', async () => {
      const sale = await create('Venda');
      expect((await update(sale.id, { archived: true })).isActive).toBe(false);
      expect((await update(sale.id, { archived: false })).isActive).toBe(true);
    });

    it('deletes only what was never used; used ones are archived instead', async () => {
      const typo = await create('Vneda');
      await remove(typo.id);
      expect(await dispositions.findById(typo.id)).toBeNull();

      const sale = await create('Venda');
      await tabulate(sale.id);
      await expect(remove(sale.id)).rejects.toThrow(DispositionInUseError);
    });

    it("another account's disposition does not exist", async () => {
      const sale = await create('Venda');
      tenant.switchTo('tenant-b');
      await expect(update(sale.id, { color: 'red' })).rejects.toThrow(DispositionNotFoundError);
      await expect(remove(sale.id)).rejects.toThrow(DispositionNotFoundError);
    });
  });

  describe('tabulating', () => {
    it('records who, when and the note, and publishes the event', async () => {
      const proposal = await create('Proposta enviada');
      const sale = await create('Venda');

      await tabulate(proposal.id, '  Mandei por e-mail  ');
      await tabulate(sale.id);

      expect((await conversation()).dispositionId).toBe(sale.id);
      const list = await new ListConversationDispositionsUseCase(history, visible).execute(
        'conv-1',
      );
      expect(list.map((r) => [r.dispositionId, r.note, r.membershipId])).toEqual([
        [sale.id, null, 'agent-1'],
        [proposal.id, 'Mandei por e-mail', 'agent-1'],
      ]);
      expect(events.published.at(-1)).toMatchObject({
        eventName: ConversationDispositionSetEvent.eventName,
        aggregateId: 'conv-1',
        dispositionId: sale.id,
        previousDispositionId: proposal.id,
        membershipId: 'agent-1',
      });
    });

    it('refuses archived or unknown dispositions and long notes', async () => {
      const old = await create('Antiga');
      await update(old.id, { archived: true });
      await expect(tabulate(old.id)).rejects.toThrow(DispositionNotFoundError);
      await expect(tabulate('nope')).rejects.toThrow(DispositionNotFoundError);

      const sale = await create('Venda');
      await expect(tabulate(sale.id, 'x'.repeat(1001))).rejects.toThrow(
        InvalidDispositionNoteError,
      );
      expect(history.items).toHaveLength(0);
    });

    it('only on conversations the member can see', async () => {
      const sale = await create('Venda');
      const other = await conversations.findById('conv-1');
      other!.assign('agent-2');
      await conversations.save(other!);

      await expect(tabulate(sale.id)).rejects.toThrow(ConversationNotFoundError);
      await expect(
        new ListConversationDispositionsUseCase(history, visible).execute('conv-1'),
      ).rejects.toThrow(ConversationNotFoundError);
    });
  });

  describe('resolving', () => {
    it('without dispositions in the account, resolves freely', async () => {
      await changeStatus('resolved');
      expect((await conversation()).status).toBe('resolved');
    });

    it('with active dispositions, an untabulated atendimento needs one', async () => {
      const sale = await create('Venda');
      await expect(changeStatus('resolved')).rejects.toThrow(DispositionRequiredError);
      expect((await conversation()).status).toBe('open');
      // Pendente não exige.
      await changeStatus('pending');

      await changeStatus('resolved', { dispositionId: sale.id, note: 'Fechou o plano anual' });
      const resolved = await conversation();
      expect(resolved.status).toBe('resolved');
      expect(resolved.dispositionId).toBe(sale.id);
      expect(history.items[0].note).toBe('Fechou o plano anual');
    });

    it('archived-only accounts do not require it', async () => {
      const old = await create('Antiga');
      await update(old.id, { archived: true });
      await changeStatus('resolved');
      expect((await conversation()).status).toBe('resolved');
    });

    it('an atendimento tabulated earlier resolves without asking again', async () => {
      const sale = await create('Venda');
      await tabulate(sale.id);
      await changeStatus('resolved');
      expect((await conversation()).status).toBe('resolved');
    });

    it('a bad disposition when resolving keeps the conversation as it was', async () => {
      await create('Venda');
      await expect(changeStatus('resolved', { dispositionId: 'nope' })).rejects.toThrow(
        DispositionNotFoundError,
      );
      expect((await conversation()).status).toBe('open');
    });

    it('after reopening, the new atendimento needs a new disposition', async () => {
      const sale = await create('Venda');
      await changeStatus('resolved', { dispositionId: sale.id });
      await changeStatus('open');

      expect((await conversation()).dispositionId).toBeNull();
      await expect(changeStatus('resolved')).rejects.toThrow(DispositionRequiredError);
    });
  });
});
