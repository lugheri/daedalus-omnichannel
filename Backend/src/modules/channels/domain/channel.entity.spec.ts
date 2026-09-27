import { Channel } from './channel.entity';
import { ChannelNotConnectedError } from './errors/channel-not-connected.error';
import { ChannelStillActiveError } from './errors/channel-still-active.error';
import { InvalidChannelNameError } from './errors/invalid-channel-name.error';
import { InvalidRecipientError } from './errors/invalid-recipient.error';
import { ChannelRemovedEvent, ChannelStatusChangedEvent } from './events/channel-events';
import { normalizeRecipient } from './recipient';

describe('Channel', () => {
  const create = () => Channel.createWhatsApp('ch-1', { tenantId: 't-1', name: ' Suporte ' });
  const at = (iso: string) => new Date(iso);

  it('starts pending, waiting for the connector', () => {
    const channel = create();

    expect(channel.name).toBe('Suporte');
    expect(channel.status).toBe('pending');
    expect(channel.provider).toBe('whatsapp_baileys');
  });

  it('requires a name', () => {
    expect(() => Channel.createWhatsApp('ch-1', { tenantId: 't', name: '  ' })).toThrow(
      InvalidChannelNameError,
    );
  });

  it('applies status reports and remembers the connected number', () => {
    const channel = create();

    channel.applyConnectionStatus({
      status: 'connected',
      phoneNumber: '+5511987654321',
      reason: null,
      at: at('2030-01-01T10:00:00Z'),
    });

    expect(channel.status).toBe('connected');
    expect(channel.phoneNumber).toBe('+5511987654321');
    const [event] = channel.pullEvents() as ChannelStatusChangedEvent[];
    expect(event).toBeInstanceOf(ChannelStatusChangedEvent);
    expect(event.previousStatus).toBe('pending');
  });

  it('ignores reports that arrive out of order', () => {
    const channel = create();
    channel.applyConnectionStatus({
      status: 'connected',
      phoneNumber: null,
      reason: null,
      at: at('2030-01-01T10:00:05Z'),
    });

    const changed = channel.applyConnectionStatus({
      status: 'awaiting_qr',
      phoneNumber: null,
      reason: null,
      at: at('2030-01-01T10:00:01Z'),
    });

    expect(changed).toBe(false);
    expect(channel.status).toBe('connected');
  });

  it('keeps the number when later reports do not carry it', () => {
    const channel = create();
    channel.applyConnectionStatus({
      status: 'connected',
      phoneNumber: '+5511987654321',
      reason: null,
      at: at('2030-01-01T10:00:00Z'),
    });
    channel.applyConnectionStatus({
      status: 'disconnected',
      phoneNumber: null,
      reason: 'connectionLost',
      at: at('2030-01-01T11:00:00Z'),
    });

    expect(channel.phoneNumber).toBe('+5511987654321');
    expect(channel.statusReason).toBe('connectionLost');
  });

  it('only sends when connected', () => {
    expect(() => create().assertCanSend()).toThrow(ChannelNotConnectedError);
  });

  it.each(['pending', 'awaiting_qr', 'connecting', 'connected'] as const)(
    'cannot be removed while %s',
    (status) => {
      const channel = create();
      channel.applyConnectionStatus({
        status,
        phoneNumber: null,
        reason: null,
        at: at('2030-01-01'),
      });
      expect(() => channel.remove()).toThrow(ChannelStillActiveError);
    },
  );

  it.each(['disconnected', 'logged_out'] as const)('can be removed when %s', (status) => {
    const channel = create();
    channel.applyConnectionStatus({
      status,
      phoneNumber: null,
      reason: null,
      at: at('2030-01-01'),
    });
    channel.pullEvents();

    channel.remove();

    expect(channel.pullEvents()).toEqual([expect.any(ChannelRemovedEvent)]);
  });
});

describe('normalizeRecipient', () => {
  it('normalizes formatted phone numbers', () => {
    expect(normalizeRecipient('+55 (11) 98765-4321')).toBe('+5511987654321');
  });

  it.each(['98765-4321', '+0123', 'abc'])('rejects "%s"', (raw) => {
    expect(() => normalizeRecipient(raw)).toThrow(InvalidRecipientError);
  });
});
