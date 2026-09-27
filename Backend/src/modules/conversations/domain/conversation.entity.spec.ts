import { Conversation } from './conversation.entity';
import {
  ConversationAssignedEvent,
  ConversationMessageAddedEvent,
  ConversationStatusChangedEvent,
} from './events/conversation-events';
import { InvalidMessageTextError } from './errors/invalid-message-text.error';
import { Message } from './message.entity';
import { isVisible, scopeFor } from './visibility';

const base = { tenantId: 't-1', conversationId: 'conv-1', channelId: 'ch-1' };
const inbound = (text: string, sentAt = new Date('2030-01-01T10:00:00Z'), id = 'm-1') =>
  Message.inbound(id, { ...base, externalId: `wa-${id}`, kind: 'text', text, sentAt });

describe('Conversation', () => {
  const start = () =>
    Conversation.start('conv-1', { tenantId: 't-1', channelId: 'ch-1', contactId: 'c-1' });

  it('counts customer messages as unread and shows the last one in the inbox', () => {
    const conversation = start();

    conversation.addMessage(inbound('Oi'));
    conversation.addMessage(inbound('Tem alguém?', new Date('2030-01-01T10:01:00Z'), 'm-2'));

    expect(conversation.unreadCount).toBe(2);
    expect(conversation.lastMessagePreview).toBe('Tem alguém?');
    expect(conversation.pullEvents()).toEqual([
      expect.any(ConversationMessageAddedEvent),
      expect.any(ConversationMessageAddedEvent),
    ]);
  });

  it('keeps the newest preview when an older message arrives late', () => {
    const conversation = start();
    conversation.addMessage(inbound('nova', new Date('2030-01-01T10:05:00Z'), 'm-2'));
    conversation.addMessage(inbound('antiga', new Date('2030-01-01T10:00:00Z'), 'm-1'));

    expect(conversation.lastMessagePreview).toBe('nova');
  });

  it('reopens when the customer writes to a resolved conversation', () => {
    const conversation = start();
    conversation.changeStatus('resolved');
    conversation.pullEvents();

    conversation.addMessage(inbound('voltei'));

    expect(conversation.status).toBe('open');
    expect(conversation.pullEvents()).toContainEqual(expect.any(ConversationStatusChangedEvent));
  });

  it('a member replying clears unread and takes the unassigned conversation', () => {
    const conversation = start();
    conversation.addMessage(inbound('Oi'));

    conversation.addMessage(
      Message.outbound('m-2', { ...base, text: 'Olá!', senderMembershipId: 'member-1' }),
    );

    expect(conversation.unreadCount).toBe(0);
    expect(conversation.assigneeId).toBe('member-1');
    expect(conversation.pullEvents()).toContainEqual(expect.any(ConversationAssignedEvent));
  });

  it('does not steal a conversation that already has an assignee', () => {
    const conversation = start();
    conversation.assign('member-1');

    conversation.addMessage(
      Message.outbound('m-2', { ...base, text: 'Oi', senderMembershipId: 'member-2' }),
    );

    expect(conversation.assigneeId).toBe('member-1');
  });

  it('messages sent from the phone only update the summary', () => {
    const conversation = start();
    conversation.addMessage(inbound('Oi'));

    conversation.addMessage(
      Message.sentFromPhone('m-2', {
        ...base,
        externalId: 'wa-2',
        kind: 'text',
        text: 'respondi pelo celular',
        sentAt: new Date('2030-01-01T10:02:00Z'),
      }),
    );

    expect(conversation.assigneeId).toBeNull();
    expect(conversation.unreadCount).toBe(1);
    expect(conversation.lastMessagePreview).toBe('respondi pelo celular');
  });
});

describe('Message', () => {
  it('rejects empty or huge replies', () => {
    const outbound = (text: string) =>
      Message.outbound('m-1', { ...base, text, senderMembershipId: 'member-1' });

    expect(() => outbound('   ')).toThrow(InvalidMessageTextError);
    expect(() => outbound('x'.repeat(4097))).toThrow(InvalidMessageTextError);
    expect(outbound('  oi  ').text).toBe('oi');
  });

  it('applies the send result once (repeated results are ignored)', () => {
    const message = Message.outbound('m-1', { ...base, text: 'oi', senderMembershipId: 'x' });

    expect(message.applySendResult({ externalId: 'wa-1', error: null })).toBe(true);
    expect(message.applySendResult({ externalId: null, error: 'late failure' })).toBe(false);
    expect(message.status).toBe('sent');
    expect(message.externalId).toBe('wa-1');
  });

  it('describes media without text in the preview', () => {
    const image = Message.inbound('m-1', {
      ...base,
      externalId: 'wa-1',
      kind: 'image',
      text: null,
      sentAt: new Date(),
    });
    expect(image.preview).toBe('📷 Imagem');
  });
});

describe('visibility', () => {
  it('view:all sees everything; own/team see their own and the unassigned', () => {
    const all = scopeFor({ membershipId: 'a', permissions: ['conversations:view:all'] })!;
    const own = scopeFor({ membershipId: 'a', permissions: ['conversations:view:own'] })!;
    const team = scopeFor({ membershipId: 'a', permissions: ['conversations:view:team'] })!;

    expect(isVisible({ assigneeId: 'b' }, all)).toBe(true);
    for (const scope of [own, team]) {
      expect(isVisible({ assigneeId: 'a' }, scope)).toBe(true);
      expect(isVisible({ assigneeId: null }, scope)).toBe(true);
      expect(isVisible({ assigneeId: 'b' }, scope)).toBe(false);
    }
  });

  it('no scope permission, no conversations', () => {
    expect(scopeFor({ membershipId: 'a', permissions: ['contacts:view'] })).toBeNull();
  });
});
