import { FakeTenantContext, RecordingRealtimeNotifier } from '../../../../shared/testing/fakes';
import { Conversation } from '../../domain/conversation.entity';
import {
  ConversationAssignedEvent,
  ConversationMessageAddedEvent,
  ConversationTeamChangedEvent,
} from '../../domain/events/conversation-events';
import { InMemoryConversationRepository } from '../../testing/fakes';
import { CONVERSATION_CHANGED, NotifyRealtimeHandler } from './notify-realtime.handler';

const tenantRoom = (p: string) => `tenant:tenant-a:perm:conversations:view:${p}`;
const teamRoom = (team: string, p: string) => `team:${team}:perm:conversations:view:${p}`;

/** Como o evento chega ao handler (dados + id da entrega). */
function delivered<E extends object>(event: E) {
  return { ...event, eventId: 'evt-1' } as never;
}

describe('NotifyRealtimeHandler', () => {
  let notifier: RecordingRealtimeNotifier;
  let conversations: InMemoryConversationRepository;
  let handler: NotifyRealtimeHandler;

  beforeEach(() => {
    notifier = new RecordingRealtimeNotifier();
    conversations = new InMemoryConversationRepository(new FakeTenantContext('tenant-a'));
    handler = new NotifyRealtimeHandler(notifier, conversations);
  });

  /** Conversa gravada na situação dada (a audiência sai da situação atual). */
  async function stored(placement: { assigneeId: string | null; teamId: string | null }) {
    const conversation = Conversation.start('conv-1', {
      tenantId: 'tenant-a',
      channelId: 'ch-1',
      contactId: 'c-1',
      teamId: placement.teamId,
    });
    conversation.assign(placement.assigneeId);
    await conversations.save(conversation);
  }
  const message = () =>
    handler.onMessage(
      delivered(new ConversationMessageAddedEvent('conv-1', 'tenant-a', 'm-1', 'inbound', null)),
    );
  const lastRooms = () => notifier.emitted.at(-1)!.rooms;

  it('general queue (no team, unassigned): everyone with a conversation scope', async () => {
    await stored({ assigneeId: null, teamId: null });
    await message();

    expect(notifier.emitted[0]).toEqual({
      rooms: [tenantRoom('all'), tenantRoom('own'), tenantRoom('team')].sort(),
      event: CONVERSATION_CHANGED,
      data: { conversationId: 'conv-1', reason: 'message' },
    });
  });

  it("team queue: the team's supervisors and agents, not the whole account", async () => {
    await stored({ assigneeId: null, teamId: 'sales' });
    await message();

    expect(lastRooms()).toEqual(
      [tenantRoom('all'), teamRoom('sales', 'team'), teamRoom('sales', 'own')].sort(),
    );
  });

  it("assigned in a team: the assignee and the team's supervisors only", async () => {
    await stored({ assigneeId: 'agent-1', teamId: 'sales' });
    await message();

    expect(lastRooms()).toEqual(
      [tenantRoom('all'), 'member:agent-1', teamRoom('sales', 'team')].sort(),
    );
  });

  it('on reassignment, the previous assignee is told too', async () => {
    await stored({ assigneeId: 'agent-2', teamId: 'sales' });
    await handler.onAssigned(
      delivered(new ConversationAssignedEvent('conv-1', 'tenant-a', 'agent-2', 'agent-1')),
    );

    expect(lastRooms()).toEqual(
      [tenantRoom('all'), 'member:agent-1', 'member:agent-2', teamRoom('sales', 'team')].sort(),
    );
  });

  it('on transfer to another team, both teams are told', async () => {
    await stored({ assigneeId: null, teamId: 'support' });
    await handler.onTeamChanged(
      delivered(new ConversationTeamChangedEvent('conv-1', 'tenant-a', 'support', 'sales')),
    );

    expect(lastRooms()).toEqual(
      [
        tenantRoom('all'),
        teamRoom('sales', 'team'),
        teamRoom('sales', 'own'),
        teamRoom('support', 'team'),
        teamRoom('support', 'own'),
      ].sort(),
    );
  });
});
