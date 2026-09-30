import type {
  EnqueueOptions,
  JobDefinition,
  JobQueue,
} from '../../../../shared/application/job-queue';
import {
  FakeSecretCipher,
  FakeTenantContext,
  ImmediateUnitOfWork,
  InMemoryActorContext,
  RecordingJobQueue,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import {
  Campaign,
  MAX_CAMPAIGN_SMS_BODY,
  SMS_OPT_OUT_FOOTER,
  type CampaignAudience,
} from '../../domain/campaign.entity';
import { MessagingNotConfiguredError } from '../../domain/errors/messaging-not-configured.error';
import { MessagingProvider } from '../../domain/messaging-provider.entity';
import {
  FakeContactDirectory,
  FakeProviderClients,
  FakeUnsubscribeTokens,
  InMemoryCampaignRepository,
  InMemoryMessagingProviderRepository,
  InMemoryOptOutRepository,
  InMemoryOutboundMessageRepository,
} from '../../testing/fakes';
import { DeliverOutboundJob, MaterializeCampaignJob } from '../messaging-jobs';
import {
  AUDIENCE_BATCH,
  MaterializeCampaignUseCase,
  StartDueCampaignsUseCase,
} from './campaign-sending.use-cases';
import {
  CancelCampaignUseCase,
  CreateCampaignUseCase,
  GetCampaignUseCase,
  ListCampaignRecipientsUseCase,
  PreviewAudienceUseCase,
  ScheduleCampaignUseCase,
} from './campaigns.use-cases';
import { DeliverOutboundMessageUseCase } from './deliver-outbound.use-cases';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

const minutes = (n: number, from = new Date()) => new Date(from.getTime() + n * 60_000);

describe('Campaign (domain)', () => {
  const draft = (
    channel: 'email' | 'sms',
    over: Partial<{ subject: string | null; body: string }> = {},
  ) =>
    Campaign.draft('c-1', {
      tenantId: 't',
      channel,
      createdByMembershipId: 'm',
      name: 'Black Friday',
      subject: 'Oferta',
      body: 'Olá {{nome}}!',
      audience: { source: 'import', sourceDetail: ' Feira 2026 ', search: '' },
      ...over,
    });

  it('validates the content and tidies the audience', () => {
    expect(draft('email').audience).toEqual({ source: 'import', sourceDetail: 'Feira 2026' });
    expect(codeOf(() => draft('email', { subject: ' ' }))).toBe('CAMPAIGN_INVALID_SUBJECT');
    // O rodapé "responda SAIR" precisa caber no SMS.
    expect(codeOf(() => draft('sms', { body: 'x'.repeat(MAX_CAMPAIGN_SMS_BODY + 1) }))).toBe(
      'CAMPAIGN_INVALID_BODY',
    );
    expect(draft('sms').subject).toBeNull();
  });

  it('schedules in the future (up to 90 days), sends now, and freezes once started', () => {
    const now = new Date('2030-01-01T10:00:00Z');
    const c = draft('email');
    expect(codeOf(() => c.schedule(minutes(-1, now), now))).toBe('CAMPAIGN_INVALID_SCHEDULE');
    expect(codeOf(() => c.schedule(minutes(91 * 24 * 60, now), now))).toBe(
      'CAMPAIGN_INVALID_SCHEDULE',
    );
    c.schedule(minutes(30, now), now);
    expect(c.status).toBe('scheduled');
    c.edit({ name: 'Ainda dá para mudar' });
    c.unschedule();
    c.schedule(null, now);
    expect(c).toMatchObject({ status: 'sending', startedAt: now });
    expect(c.start()).toBe(false); // idempotente
    expect(codeOf(() => c.edit({ name: 'x' }))).toBe('CAMPAIGN_NOT_EDITABLE');
    // Montada ("sent"): as entregas ainda estão saindo no ritmo do canal — dá para parar.
    c.finish();
    c.cancel();
    expect(c.status).toBe('canceled');
    expect(codeOf(() => c.cancel())).toBe('CAMPAIGN_NOT_CANCELABLE');
    // Rascunho não se cancela: exclui.
    expect(codeOf(() => draft('sms').cancel())).toBe('CAMPAIGN_NOT_CANCELABLE');
  });
});

/** Guarda o tenant de cada job (o processor o restaura no worker). */
class TenantRecordingJobQueue implements JobQueue {
  readonly jobs: { name: string; payload: unknown; tenantId: string; options?: EnqueueOptions }[] =
    [];
  constructor(private readonly tenant: FakeTenantContext) {}
  add<T>(job: JobDefinition<T>, payload: T, options?: EnqueueOptions): Promise<void> {
    this.jobs.push({ name: job.name, payload, tenantId: this.tenant.tenantId, options });
    return Promise.resolve();
  }
}

describe('Campaigns', () => {
  let tenant: FakeTenantContext;
  let campaigns: InMemoryCampaignRepository;
  let providers: InMemoryMessagingProviderRepository;
  let messages: InMemoryOutboundMessageRepository;
  let optOuts: InMemoryOptOutRepository;
  let contacts: FakeContactDirectory;
  let jobs: RecordingJobQueue;
  let ids: SequentialIdGenerator;
  let actors: InMemoryActorContext;
  const uow = new ImmediateUnitOfWork();
  const cipher = new FakeSecretCipher();

  beforeEach(async () => {
    tenant = new FakeTenantContext('tenant-a');
    campaigns = new InMemoryCampaignRepository(tenant);
    providers = new InMemoryMessagingProviderRepository(tenant);
    messages = new InMemoryOutboundMessageRepository(tenant);
    optOuts = new InMemoryOptOutRepository(tenant);
    contacts = new FakeContactDirectory();
    jobs = new RecordingJobQueue();
    ids = new SequentialIdGenerator();
    actors = new InMemoryActorContext();
    actors.authenticate({
      userId: 'u',
      tenantId: 'tenant-a',
      membershipId: 'mgr-1',
      sessionId: 's',
    });
    await providers.save(
      MessagingProvider.configure('prov-sms', {
        tenantId: 'tenant-a',
        settings: {
          provider: 'twilio',
          accountSid: 'AC' + '1'.repeat(32),
          from: '+15005550006',
          messagingServiceSid: null,
        },
        secret: { sealed: cipher.seal('token'), hint: 'oken' },
      }),
    );
    const people: [string, string | null, string | null, string][] = [
      ['c-01', 'Maria Souza', '+5511900000001', 'Feira 2026'],
      ['c-02', 'João', '+5511900000002', 'Feira 2026'],
      ['c-03', 'Sem Telefone', null, 'Feira 2026'],
      ['c-04', null, '+5511900000004', 'Feira 2026'],
      ['c-05', 'Descadastrada', '+5511900000005', 'Feira 2026'],
      ['c-06', 'Outro lote', '+5511900000006', 'Site'],
    ];
    for (const [id, name, phone, sourceDetail] of people) {
      contacts.contacts.set(id, { id, name, phone, email: null, source: 'import', sourceDetail });
    }
    await optOuts.add({
      tenantId: 'tenant-a',
      channel: 'sms',
      address: '+5511900000005',
      source: 'sms_reply',
      createdAt: new Date(),
    });
  });

  const create = (
    over: Partial<{ channel: 'email' | 'sms'; body: string; audience: CampaignAudience }> = {},
  ) =>
    new CreateCampaignUseCase(campaigns, actors, tenant, ids).execute({
      name: 'Feira',
      channel: 'sms',
      body: 'Oi {{nome}}, obrigado pela visita!',
      audience: { sourceDetail: 'feira 2026' },
      ...over,
    });
  const schedule = (id: string, at: Date | null) =>
    new ScheduleCampaignUseCase(campaigns, providers, jobs).execute(id, at);
  const materialize = (id: string) =>
    new MaterializeCampaignUseCase(campaigns, contacts, optOuts, messages, jobs, ids, uow).execute(
      id,
    );

  it('previews the audience and who can be reached in the channel', async () => {
    expect(
      await new PreviewAudienceUseCase(contacts).execute('sms', { sourceDetail: 'Feira 2026' }),
    ).toEqual({ total: 5, reachable: 4 });
  });

  it('needs the channel provider; "send now" starts and queues the build-up once', async () => {
    const email = await create({ channel: 'email' });
    await expect(schedule(email.id, null)).rejects.toThrow(MessagingNotConfiguredError);

    const sms = await create();
    expect((await schedule(sms.id, null)).status).toBe('sending');
    expect(jobs.jobs).toEqual([
      expect.objectContaining({
        name: MaterializeCampaignJob.name,
        options: { jobId: `campaign:${sms.id}` },
      }),
    ]);
  });

  it('builds the audience: personalized, SMS opt-out footer, skips counted, paced 1 SMS/s', async () => {
    const campaign = await create();
    await schedule(campaign.id, null);
    await materialize(campaign.id);

    const created = messages.items.filter((m) => m.campaignId === campaign.id);
    expect(created.map((m) => [m.contactId, m.to])).toEqual([
      ['c-01', '+5511900000001'],
      ['c-02', '+5511900000002'],
      ['c-04', '+5511900000004'],
    ]);
    expect(created[0].body).toBe(`Oi Maria, obrigado pela visita!\n\n${SMS_OPT_OUT_FOOTER}`);
    expect(created[2].body.startsWith('Oi, obrigado pela visita!')).toBe(true); // sem nome
    expect(created.every((m) => m.sentByMembershipId === null && m.status === 'queued')).toBe(true);

    const deliveries = jobs.jobs.filter((j) => j.name === DeliverOutboundJob.name);
    expect(deliveries.map((j) => j.options?.delayMs)).toEqual([0, 1000, 2000]);

    const { campaign: done, counts } = await new GetCampaignUseCase(campaigns, messages).execute(
      campaign.id,
    );
    expect(done).toMatchObject({
      status: 'sent',
      queuedCount: 3,
      skippedNoAddress: 1,
      skippedOptedOut: 1,
    });
    expect(counts.queued).toBe(3);

    const recipients = await new ListCampaignRecipientsUseCase(
      campaigns,
      messages,
      contacts,
    ).execute(campaign.id, { limit: 10 });
    expect(recipients.items.map((r) => r.contact?.name ?? null)).toEqual([
      'Maria Souza',
      'João',
      null,
    ]);
  });

  it(`goes in batches of ${AUDIENCE_BATCH} and resumes after a crash without duplicates`, async () => {
    for (let i = 0; i < AUDIENCE_BATCH + 20; i++) {
      const id = `x-${String(i).padStart(4, '0')}`;
      contacts.contacts.set(id, {
        id,
        name: `Pessoa ${i}`,
        phone: `+551190001${String(i).padStart(4, '0')}`,
        email: null,
        source: 'site',
        sourceDetail: 'Lote grande',
      });
    }
    const campaign = await create({ audience: { sourceDetail: 'Lote grande' } });
    await schedule(campaign.id, null);

    // "Queda" depois do 1º lote: grava o lote e o cursor, e para.
    class CrashingAfterFirstPage extends FakeContactDirectory {
      override audiencePage(...args: Parameters<FakeContactDirectory['audiencePage']>) {
        if (args[1].cursor) return Promise.reject(new Error('worker caiu'));
        return super.audiencePage(...args);
      }
    }
    const crashing = new CrashingAfterFirstPage();
    for (const [id, contact] of contacts.contacts) crashing.contacts.set(id, contact);
    const partial = new MaterializeCampaignUseCase(
      campaigns,
      crashing,
      optOuts,
      messages,
      jobs,
      ids,
      uow,
    );
    await expect(partial.execute(campaign.id)).rejects.toThrow('worker caiu');
    expect((await campaigns.findById(campaign.id))!.queuedCount).toBe(AUDIENCE_BATCH);

    await materialize(campaign.id); // retoma do cursor
    const created = messages.items.filter((m) => m.campaignId === campaign.id);
    expect(created).toHaveLength(AUDIENCE_BATCH + 20);
    expect(new Set(created.map((m) => m.contactId)).size).toBe(AUDIENCE_BATCH + 20);
    expect((await campaigns.findById(campaign.id))!.status).toBe('sent');
    // O último lote sai no ritmo de onde parou (não recomeça do 0).
    expect(
      jobs.jobs.filter((j) => j.name === DeliverOutboundJob.name).at(-1)?.options?.delayMs,
    ).toBe((AUDIENCE_BATCH + 19) * 1000);
  });

  it('canceling after the build-up stops the messages still waiting their turn', async () => {
    const campaign = await create();
    await schedule(campaign.id, null);
    await materialize(campaign.id); // montada; as entregas estão na fila, com atraso
    await new CancelCampaignUseCase(campaigns).execute(campaign.id);

    const clients = new FakeProviderClients();
    const deliver = new DeliverOutboundMessageUseCase(
      messages,
      providers,
      optOuts,
      clients,
      cipher,
      new FakeUnsubscribeTokens(),
      { publicApiUrl: 'https://api.x', webhooksReachable: false },
      campaigns,
    );
    const [queued] = messages.items.filter((m) => m.campaignId === campaign.id);
    await deliver.execute(queued.id);
    expect(clients.sentSms).toEqual([]);
    expect((await messages.findById(queued.id))!).toMatchObject({
      status: 'failed',
      error: 'CAMPAIGN_CANCELED',
    });
  });

  it('the sweep starts due scheduled campaigns, each in its own tenant', async () => {
    const due = await create();
    const later = await create();
    await schedule(due.id, minutes(10));
    await schedule(later.id, minutes(120));
    const tenantJobs = new TenantRecordingJobQueue(tenant);
    tenant.switchTo(null);

    expect(
      await new StartDueCampaignsUseCase(campaigns, tenant, tenantJobs).execute(minutes(11)),
    ).toBe(1);
    expect(tenantJobs.jobs).toEqual([
      expect.objectContaining({
        name: MaterializeCampaignJob.name,
        payload: { campaignId: due.id },
        tenantId: 'tenant-a',
      }),
    ]);
    expect((await campaigns.findById(due.id))!.status).toBe('sending');
    expect((await campaigns.findById(later.id))!.status).toBe('scheduled');
  });
});
