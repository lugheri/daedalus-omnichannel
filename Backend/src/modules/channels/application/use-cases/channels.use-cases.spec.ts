import {
  SendWhatsAppText,
  StartWhatsAppSession,
  StopWhatsAppSession,
} from '../../../../contracts/whatsapp-connector.contract';
import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  RecordingJobQueue,
  RecordingRealtimeNotifier,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { ChannelNotConnectedError } from '../../domain/errors/channel-not-connected.error';
import { ChannelNotFoundError } from '../../domain/errors/channel-not-found.error';
import { ChannelStillActiveError } from '../../domain/errors/channel-still-active.error';
import {
  ChannelMessageReceivedEvent,
  ChannelRemovedEvent,
  ChannelStatusChangedEvent,
} from '../../domain/events/channel-events';
import {
  FakeQrCodeReader,
  InMemoryChannelRepository,
  SequentialPublicKeyGenerator,
} from '../../testing/fakes';
import { ChannelSender } from '../channel-sender';
import {
  ApplyConnectionReportUseCase,
  RecordInboundMessageUseCase,
} from './connector-reports.use-case';
import {
  ConnectChannelUseCase,
  CreateWhatsAppChannelUseCase,
  DisconnectChannelUseCase,
  GetChannelQrCodeUseCase,
  RemoveChannelUseCase,
  SendTestMessageUseCase,
} from './manage-channels.use-case';
import {
  CreateWebChatChannelUseCase,
  ReceiveWebChatMessageUseCase,
  UpdateWebChatChannelUseCase,
} from './web-chat.use-cases';

describe('Channels', () => {
  let tenant: FakeTenantContext;
  let channels: InMemoryChannelRepository;
  let jobs: RecordingJobQueue;
  let events: RecordingEventBus;
  let realtime: RecordingRealtimeNotifier;
  let qrCodes: FakeQrCodeReader;
  let ids: SequentialIdGenerator;

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    channels = new InMemoryChannelRepository(tenant);
    jobs = new RecordingJobQueue();
    events = new RecordingEventBus();
    realtime = new RecordingRealtimeNotifier();
    qrCodes = new FakeQrCodeReader();
    ids = new SequentialIdGenerator();
  });

  const createChannel = () =>
    new CreateWhatsAppChannelUseCase(channels, tenant, ids, jobs).execute({ name: 'Suporte' });

  const report = (status: 'connected' | 'awaiting_qr', at = '2030-01-01T10:00:00Z') =>
    new ApplyConnectionReportUseCase(channels, events, new ImmediateUnitOfWork()).execute({
      channelId: 'id-1',
      tenantId: 'tenant-a',
      status,
      phoneNumber: status === 'connected' ? '+5511987654321' : null,
      reason: null,
      at,
    });

  it('creating a channel asks the connector to start the session', async () => {
    const channel = await createChannel();

    expect(channel.status).toBe('pending');
    expect(jobs.of(StartWhatsAppSession)).toEqual([
      { channelId: channel.id, tenantId: 'tenant-a' },
    ]);
  });

  it('shows the QR code while not connected, and hides it once connected', async () => {
    const channel = await createChannel();
    qrCodes.codes.set(channel.id, 'qr-data');
    const getQr = new GetChannelQrCodeUseCase(channels, qrCodes);

    expect((await getQr.execute(channel.id)).qrCode).toBe('qr-data');
    await report('connected');
    expect((await getQr.execute(channel.id)).qrCode).toBeNull();
  });

  it("does not reveal other tenants' channels", async () => {
    const channel = await createChannel();
    tenant.switchTo('tenant-b');

    await expect(
      new DisconnectChannelUseCase(channels, jobs, events, new ImmediateUnitOfWork()).execute(
        channel.id,
      ),
    ).rejects.toThrow(ChannelNotFoundError);
    expect(jobs.of(StopWhatsAppSession)).toHaveLength(0);
  });

  it('disconnecting unpairs the number', async () => {
    const channel = await createChannel();

    await new DisconnectChannelUseCase(channels, jobs, events, new ImmediateUnitOfWork()).execute(
      channel.id,
    );

    expect(jobs.of(StopWhatsAppSession)).toEqual([{ channelId: channel.id, logout: true }]);
  });

  describe('sending', () => {
    const send = () =>
      new SendTestMessageUseCase(channels, ids, new ChannelSender(jobs, realtime, events)).execute({
        channelId: 'id-1',
        to: '+55 11 91234-5678',
        text: 'Olá!',
      });

    it('refuses to send before the channel is connected', async () => {
      await createChannel();

      await expect(send()).rejects.toThrow(ChannelNotConnectedError);
    });

    it('sends with a normalized number and a stable job id', async () => {
      await createChannel();
      await report('connected');

      const messageId = await send();

      expect(jobs.of(SendWhatsAppText)[0]).toMatchObject({ to: '+5511912345678', messageId });
      expect(jobs.jobs.at(-1)?.options?.jobId).toBe(`send:${messageId}`);
    });
  });

  describe('connector reports', () => {
    it('updates the status and announces the change', async () => {
      await createChannel();

      await report('connected');

      expect((await channels.findById('id-1'))?.status).toBe('connected');
      expect(events.published[0]).toBeInstanceOf(ChannelStatusChangedEvent);
    });

    it('turns an inbound message into a public domain event', async () => {
      await createChannel();

      await new RecordInboundMessageUseCase(channels, events, new ImmediateUnitOfWork()).execute({
        channelId: 'id-1',
        tenantId: 'tenant-a',
        externalId: 'WA-123',
        contactPhone: '+5511912345678',
        contactJid: '5511912345678@s.whatsapp.net',
        contactName: 'Cliente',
        fromMe: false,
        kind: 'text',
        text: 'Oi, preciso de ajuda',
        sentAt: '2030-01-01T10:00:00Z',
      });

      const [event] = events.published as ChannelMessageReceivedEvent[];
      expect(event).toBeInstanceOf(ChannelMessageReceivedEvent);
      expect(event.tenantId).toBe('tenant-a');
      expect(event.message).toMatchObject({ externalId: 'WA-123', text: 'Oi, preciso de ajuda' });
    });
  });
  describe('removing a channel', () => {
    const remove = (id: string) =>
      new RemoveChannelUseCase(channels, events, new ImmediateUnitOfWork()).execute(id);

    it('refuses while the channel is active, and keeps it', async () => {
      const channel = await createChannel();
      await report('connected');

      await expect(remove(channel.id)).rejects.toThrow(ChannelStillActiveError);
      expect(await channels.findById(channel.id)).not.toBeNull();
    });

    it('deletes a disconnected channel and announces it (the connector purges the session)', async () => {
      const channel = await createChannel();
      await new ApplyConnectionReportUseCase(channels, events, new ImmediateUnitOfWork()).execute({
        channelId: channel.id,
        tenantId: 'tenant-a',
        status: 'logged_out',
        phoneNumber: null,
        reason: 'requested',
        at: '2030-01-01T10:00:00Z',
      });

      await remove(channel.id);

      expect(await channels.findById(channel.id)).toBeNull();
      expect(events.published.at(-1)).toBeInstanceOf(ChannelRemovedEvent);
    });

    it("cannot remove another tenant's channel", async () => {
      const channel = await createChannel();
      tenant.switchTo('tenant-b');

      await expect(remove(channel.id)).rejects.toThrow(ChannelNotFoundError);
    });
  });

  describe('web chat', () => {
    const keys = new SequentialPublicKeyGenerator();
    const createWebChat = () =>
      new CreateWebChatChannelUseCase(channels, keys, tenant, ids).execute({ name: 'Site' });
    const toggle = (enabled: boolean, channelId: string) =>
      enabled
        ? new ConnectChannelUseCase(channels, jobs, events, new ImmediateUnitOfWork()).execute(
            channelId,
          )
        : new DisconnectChannelUseCase(channels, jobs, events, new ImmediateUnitOfWork()).execute(
            channelId,
          );

    it('is born on, with a widget key and default settings; no connector involved', async () => {
      const channel = await createWebChat();
      expect(channel.provider).toBe('web_chat');
      expect(channel.status).toBe('connected');
      expect(channel.publicKey).toMatch(/^chave-/);
      expect(channel.settings?.title).toBe('Fale com a gente');
      expect(jobs.jobs).toHaveLength(0);

      await toggle(false, channel.id);
      expect((await channels.findById(channel.id))?.status).toBe('disconnected');
      expect(jobs.jobs).toHaveLength(0);
      expect(events.published.some((e) => e instanceof ChannelStatusChangedEvent)).toBe(true);
      await toggle(true, channel.id);
      expect((await channels.findById(channel.id))?.status).toBe('connected');
    });

    it('validates settings and rotates the key', async () => {
      const channel = await createWebChat();
      const keyBefore = channel.publicKey;
      const update = new UpdateWebChatChannelUseCase(channels, keys);
      const updated = await update.execute(channel.id, { color: '#0F766E', rotateKey: true });
      expect(updated.settings?.color).toBe('#0f766e');
      expect(updated.publicKey).not.toBe(keyBefore);
      await expect(update.execute(channel.id, { color: 'azul' })).rejects.toMatchObject({
        code: 'CHANNEL_INVALID_CHAT_COLOR',
      });
      await expect(update.execute(channel.id, { title: ' ' })).rejects.toMatchObject({
        code: 'CHANNEL_INVALID_CHAT_TITLE',
      });
      const whatsapp = await createChannel();
      await expect(update.execute(whatsapp.id, { title: 'x' })).rejects.toMatchObject({
        code: 'CHANNEL_NOT_WEB_CHAT',
      });
    });

    it('a visitor message becomes the usual channel event, with the contact already known', async () => {
      const channel = await createWebChat();
      const receive = new ReceiveWebChatMessageUseCase(channels, events, new ImmediateUnitOfWork());
      await receive.execute({
        channelId: channel.id,
        contactId: 'contato-1',
        contactName: 'Ana',
        externalId: 'cliente-msg-1',
        text: 'Oi, vocês abrem sábado?',
      });
      const [event] = events.published.filter((e) => e instanceof ChannelMessageReceivedEvent);
      expect(event.message).toMatchObject({
        externalId: 'cliente-msg-1',
        contactId: 'contato-1',
        contactPhone: null,
        kind: 'text',
        fromMe: false,
      });

      await toggle(false, channel.id);
      await expect(
        receive.execute({
          channelId: channel.id,
          contactId: 'contato-1',
          contactName: null,
          externalId: 'cliente-msg-2',
          text: 'Oi?',
        }),
      ).rejects.toThrow(ChannelNotConnectedError);
    });

    it('a reply goes straight to the visitor: realtime signal and "sent" result', async () => {
      const channel = await createWebChat();
      await new ChannelSender(jobs, realtime, events).send(channel, {
        messageId: 'msg-9',
        to: 'contato-1',
        text: 'Abrimos sim!',
      });
      expect(jobs.jobs).toHaveLength(0);
      expect(realtime.emitted).toEqual([
        {
          rooms: [`webchat:${channel.id}:contato-1`],
          event: 'chat.message',
          data: { messageId: 'msg-9' },
          namespace: '/chat',
        },
      ]);
      expect(events.published.at(-1)).toMatchObject({
        result: { messageId: 'msg-9', status: 'sent', externalId: 'msg-9', error: null },
      });
    });

    it('no QR code, test message or media on the web chat', async () => {
      const channel = await createWebChat();
      await expect(
        new SendTestMessageUseCase(
          channels,
          ids,
          new ChannelSender(jobs, realtime, events),
        ).execute({ channelId: channel.id, to: '+5511987654321', text: 'teste' }),
      ).rejects.toMatchObject({ code: 'CHANNEL_NOT_WHATSAPP' });
    });
  });
});
