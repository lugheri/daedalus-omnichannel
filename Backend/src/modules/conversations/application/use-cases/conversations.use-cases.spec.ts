import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { ConversationNotFoundError } from '../../domain/errors/conversation-not-found.error';
import { ContactWithoutPhoneError } from '../../domain/errors/contact-without-phone.error';
import {
  ConversationMessageAddedEvent,
  ConversationMessageStatusChangedEvent,
} from '../../domain/events/conversation-events';
import {
  FakeChannelGateway,
  FakeContactDirectory,
  FakeMemberAccess,
  InMemoryConversationRepository,
  InMemoryMessageRepository,
} from '../../testing/fakes';
import { VisibleConversations } from '../visible-conversations';
import { ApplySendResultUseCase } from './apply-send-result/apply-send-result.use-case';
import { ListConversationsUseCase } from './list-conversations/list-conversations.use-case';
import { ListMessagesUseCase } from './list-messages/list-messages.use-case';
import {
  RecordChannelMessageUseCase,
  type ChannelMessageInput,
} from './record-channel-message/record-channel-message.use-case';
import { SendMessageUseCase } from './send-message/send-message.use-case';
import {
  ChangeConversationStatusUseCase,
  MarkConversationReadUseCase,
} from './update-conversation/update-conversation.use-cases';

describe('Conversations', () => {
  let tenant: FakeTenantContext;
  let conversations: InMemoryConversationRepository;
  let messages: InMemoryMessageRepository;
  let contacts: FakeContactDirectory;
  let channels: FakeChannelGateway;
  let access: FakeMemberAccess;
  let events: RecordingEventBus;
  let ids: SequentialIdGenerator;
  let visible: VisibleConversations;

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    conversations = new InMemoryConversationRepository(tenant);
    messages = new InMemoryMessageRepository(tenant);
    contacts = new FakeContactDirectory(tenant);
    channels = new FakeChannelGateway();
    access = new FakeMemberAccess({
      membershipId: 'agent-1',
      permissions: ['conversations:view:own'],
    });
    events = new RecordingEventBus();
    ids = new SequentialIdGenerator();
    visible = new VisibleConversations(conversations, access);
  });

  const uow = new ImmediateUnitOfWork();
  const record = (overrides: Partial<ChannelMessageInput> = {}) =>
    new RecordChannelMessageUseCase(
      conversations,
      messages,
      contacts,
      tenant,
      ids,
      events,
      uow,
    ).execute({
      channelId: 'channel-1',
      externalId: 'WA-1',
      contactPhone: '+5511987654321',
      contactName: 'Cliente',
      fromMe: false,
      kind: 'text',
      text: 'Oi, preciso de ajuda',
      sentAt: '2030-01-01T10:00:00Z',
      ...overrides,
    });
  const send = (conversationId: string, text = 'Olá! Como posso ajudar?') =>
    new SendMessageUseCase(
      conversations,
      messages,
      contacts,
      channels,
      ids,
      events,
      uow,
      visible,
    ).execute({ conversationId, text });
  const list = () =>
    new ListConversationsUseCase(conversations, contacts, channels, visible).execute({
      limit: 20,
    });
  const onlyConversation = async () => (await list()).items[0].conversation;

  describe('receiving', () => {
    it('creates the contact and the conversation on the first message', async () => {
      expect(await record()).toBe('recorded');

      const [view] = (await list()).items;
      expect(view.contact).toMatchObject({ phone: '+5511987654321', name: 'Cliente' });
      expect(view.conversation).toMatchObject({ status: 'open', unreadCount: 1 });
      expect(view.conversation.lastMessagePreview).toBe('Oi, preciso de ajuda');
      expect(events.published).toContainEqual(expect.any(ConversationMessageAddedEvent));
    });

    it('keeps the same conversation for the next messages of the contact', async () => {
      await record();
      await record({ externalId: 'WA-2', text: 'alguém?' });

      expect((await list()).items).toHaveLength(1);
      expect(messages.items).toHaveLength(2);
    });

    it('records a duplicated delivery only once', async () => {
      await record();
      expect(await record()).toBe('duplicate');
      expect(messages.items).toHaveLength(1);
    });

    it('records messages sent from the phone as outbound, already sent', async () => {
      await record();
      await record({ externalId: 'WA-2', fromMe: true, text: 'respondi no celular' });

      expect(messages.items[1]).toMatchObject({ direction: 'outbound', status: 'sent' });
    });

    it('skips contacts without a phone number (LID only)', async () => {
      expect(await record({ contactPhone: null })).toBe('skipped');
      expect(messages.items).toHaveLength(0);
    });
  });

  describe('replying', () => {
    it('records the reply as pending, queues it, and assigns the conversation', async () => {
      await record();
      const conversation = await onlyConversation();

      const message = await send(conversation.id);

      expect(message).toMatchObject({ status: 'pending', senderMembershipId: 'agent-1' });
      expect(channels.sent).toEqual([
        {
          channelId: 'channel-1',
          messageId: message.id,
          to: '+5511987654321',
          text: 'Olá! Como posso ajudar?',
        },
      ]);
      expect(await onlyConversation()).toMatchObject({ assigneeId: 'agent-1', unreadCount: 0 });
    });

    it('does not record anything when the channel is not connected', async () => {
      await record();
      channels.connected = false;

      await expect(send((await onlyConversation()).id)).rejects.toThrow('CHANNEL_NOT_CONNECTED');
      expect(messages.items).toHaveLength(1);
    });

    it('marks the reply as failed when it cannot be queued', async () => {
      await record();
      channels.failEnqueue = true;

      await expect(send((await onlyConversation()).id)).rejects.toThrow('queue down');
      expect(messages.items[1]).toMatchObject({ status: 'failed', error: 'enqueue_failed' });
    });

    it('refuses to reply to a contact without phone', async () => {
      await record();
      const conversation = await onlyConversation();
      contacts.findById = () => Promise.resolve({ id: 'x', name: null, phone: null });

      await expect(send(conversation.id)).rejects.toThrow(ContactWithoutPhoneError);
    });

    it('applies the send result from the channel', async () => {
      await record();
      const message = await send((await onlyConversation()).id);
      const apply = new ApplySendResultUseCase(messages, events, uow);

      await apply.execute({ messageId: message.id, externalId: 'WA-OUT', error: null });
      await apply.execute({
        messageId: 'test-message-of-channels-page',
        externalId: null,
        error: null,
      });

      expect(await messages.findById(message.id)).toMatchObject({
        status: 'sent',
        externalId: 'WA-OUT',
      });
      expect(events.published).toContainEqual(expect.any(ConversationMessageStatusChangedEvent));
    });
  });

  describe('visibility', () => {
    it("an agent does not see (nor reply to) a colleague's conversation", async () => {
      await record();
      const conversation = await onlyConversation();
      conversation.assign('agent-2');
      await conversations.save(conversation);

      expect((await list()).items).toHaveLength(0);
      await expect(send(conversation.id)).rejects.toThrow(ConversationNotFoundError);
      await expect(
        new ListMessagesUseCase(messages, visible).execute(conversation.id, { limit: 10 }),
      ).rejects.toThrow(ConversationNotFoundError);
    });

    it('view:all sees conversations assigned to anyone', async () => {
      await record();
      const conversation = await onlyConversation();
      conversation.assign('agent-2');
      await conversations.save(conversation);

      access.member = { membershipId: 'admin-1', permissions: ['conversations:view:all'] };

      expect((await list()).items).toHaveLength(1);
    });

    it("does not reveal other tenants' conversations", async () => {
      await record();
      const conversation = await onlyConversation();
      tenant.switchTo('tenant-b');

      expect((await list()).items).toHaveLength(0);
      await expect(send(conversation.id)).rejects.toThrow(ConversationNotFoundError);
    });
  });

  it('changes status and marks as read', async () => {
    await record();
    const conversation = await onlyConversation();

    await new ChangeConversationStatusUseCase(conversations, events, uow, visible).execute({
      conversationId: conversation.id,
      status: 'resolved',
    });
    await new MarkConversationReadUseCase(conversations, visible).execute(conversation.id);

    expect(await onlyConversation()).toMatchObject({ status: 'resolved', unreadCount: 0 });
  });
});
