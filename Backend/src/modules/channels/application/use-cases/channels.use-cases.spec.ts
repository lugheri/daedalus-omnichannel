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
import { FakeQrCodeReader, InMemoryChannelRepository } from '../../testing/fakes';
import { ChannelTextSender } from '../channel-text-sender';
import {
  ApplyConnectionReportUseCase,
  RecordInboundMessageUseCase,
} from './connector-reports.use-case';
import {
  CreateWhatsAppChannelUseCase,
  DisconnectChannelUseCase,
  GetChannelQrCodeUseCase,
  RemoveChannelUseCase,
  SendTestMessageUseCase,
} from './manage-channels.use-case';

describe('Channels', () => {
  let tenant: FakeTenantContext;
  let channels: InMemoryChannelRepository;
  let jobs: RecordingJobQueue;
  let events: RecordingEventBus;
  let qrCodes: FakeQrCodeReader;
  let ids: SequentialIdGenerator;

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    channels = new InMemoryChannelRepository(tenant);
    jobs = new RecordingJobQueue();
    events = new RecordingEventBus();
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

    await expect(new DisconnectChannelUseCase(channels, jobs).execute(channel.id)).rejects.toThrow(
      ChannelNotFoundError,
    );
    expect(jobs.of(StopWhatsAppSession)).toHaveLength(0);
  });

  it('disconnecting unpairs the number', async () => {
    const channel = await createChannel();

    await new DisconnectChannelUseCase(channels, jobs).execute(channel.id);

    expect(jobs.of(StopWhatsAppSession)).toEqual([{ channelId: channel.id, logout: true }]);
  });

  describe('sending', () => {
    const send = () =>
      new SendTestMessageUseCase(channels, ids, new ChannelTextSender(jobs)).execute({
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
});
