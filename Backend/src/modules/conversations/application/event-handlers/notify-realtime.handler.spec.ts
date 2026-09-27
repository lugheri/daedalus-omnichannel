import { FakeTenantContext, RecordingRealtimeNotifier } from '../../../../shared/testing/fakes';
import { Conversation } from '../../domain/conversation.entity';
import {
  ConversationAssignedEvent,
  ConversationMessageAddedEvent,
  ConversationStatusChangedEvent,
} from '../../domain/events/conversation-events';
import { InMemoryConversationRepository } from '../../testing/fakes';
import { CONVERSATION_CHANGED, NotifyRealtimeHandler } from './notify-realtime.handler';

const ALL = 'tenant:tenant-a:perm:conversations:view:all';
const OWN = 'tenant:tenant-a:perm:conversations:view:own';
const TEAM = 'tenant:tenant-a:perm:conversations:view:team';

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

  it('an unassigned conversation goes to view:all and to the queue of own/team', async () => {
    await handler.onMessage(
      delivered(new ConversationMessageAddedEvent('conv-1', 'tenant-a', 'msg-1', 'inbound', null)),
    );

    expect(notifier.emitted).toEqual([
      {
        rooms: [ALL, OWN, TEAM].sort(),
        event: CONVERSATION_CHANGED,
        data: { conversationId: 'conv-1', reason: 'message' },
      },
    ]);
  });

  it('an assigned conversation goes only to view:all and to the assignee', async () => {
    await handler.onMessage(
      delivered(
        new ConversationMessageAddedEvent('conv-1', 'tenant-a', 'msg-1', 'inbound', 'agent-1'),
      ),
    );

    expect(notifier.emitted[0].rooms).toEqual([ALL, 'member:agent-1'].sort());
  });

  it('on reassignment, the previous assignee is told too (it leaves their list)', async () => {
    await handler.onAssigned(
      delivered(new ConversationAssignedEvent('conv-1', 'tenant-a', 'agent-2', 'agent-1')),
    );

    expect(notifier.emitted[0].rooms).toEqual([ALL, 'member:agent-1', 'member:agent-2'].sort());
  });

  it('events without assignee use the CURRENT assignee of the conversation', async () => {
    const conversation = Conversation.start('conv-1', {
      tenantId: 'tenant-a',
      channelId: 'ch-1',
      contactId: 'c-1',
    });
    conversation.assign('agent-3');
    await conversations.save(conversation);

    await handler.onStatus(
      delivered(new ConversationStatusChangedEvent('conv-1', 'tenant-a', 'resolved', 'open')),
    );

    expect(notifier.emitted[0]).toMatchObject({
      rooms: [ALL, 'member:agent-3'].sort(),
      data: { reason: 'status' },
    });
  });
});
