import {
  FakeSecretCipher,
  FakeTenantContext,
  ImmediateUnitOfWork,
  InMemoryActorContext,
  RecordingJobQueue,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { ContactWithoutAddressError } from '../../domain/errors/contact-without-address.error';
import { MessagingNotConfiguredError } from '../../domain/errors/messaging-not-configured.error';
import { OptedOutError } from '../../domain/errors/opted-out.error';
import { ProviderRejectedError } from '../../domain/errors/provider-rejected.error';
import { ProviderUnavailableError } from '../../domain/errors/provider-unavailable.error';
import { MessagingProvider, type EmailSettings } from '../../domain/messaging-provider.entity';
import {
  FakeContactDirectory,
  FakeProviderClients,
  FakeUnsubscribeTokens,
  FakeWebhookVerifier,
  InMemoryMessagingProviderRepository,
  InMemoryOptOutRepository,
  InMemoryOutboundMessageRepository,
} from '../../testing/fakes';
import { DeliverOutboundJob, InboundSmsJob, ProviderEventsJob } from '../messaging-jobs';
import type { MessagingUrls } from '../ports/messaging-urls';
import {
  ListContactOptOutsUseCase,
  RemoveContactOptOutUseCase,
  SendToContactUseCase,
} from './contact-messages.use-cases';
import {
  DeliverOutboundMessageUseCase,
  GiveUpOutboundMessageUseCase,
} from './deliver-outbound.use-cases';
import {
  AcceptProviderWebhookUseCase,
  ApplyProviderEventsUseCase,
  parseSendGridEvents,
  RecordInboundSmsUseCase,
  WebhookRejected,
} from './provider-webhooks.use-cases';
import { UnsubscribeUseCase } from './unsubscribe.use-cases';

const cipher = new FakeSecretCipher();
const SID = 'AC' + '1'.repeat(32);

describe('Messages to contacts', () => {
  let tenant: FakeTenantContext;
  let providers: InMemoryMessagingProviderRepository;
  let messages: InMemoryOutboundMessageRepository;
  let optOuts: InMemoryOptOutRepository;
  let contacts: FakeContactDirectory;
  let clients: FakeProviderClients;
  let jobs: RecordingJobQueue;
  let ids: SequentialIdGenerator;
  let actors: InMemoryActorContext;
  let urls: MessagingUrls;
  const tokens = new FakeUnsubscribeTokens();
  const uow = new ImmediateUnitOfWork();

  beforeEach(async () => {
    tenant = new FakeTenantContext('tenant-a');
    providers = new InMemoryMessagingProviderRepository(tenant);
    messages = new InMemoryOutboundMessageRepository(tenant);
    optOuts = new InMemoryOptOutRepository(tenant);
    contacts = new FakeContactDirectory();
    clients = new FakeProviderClients();
    jobs = new RecordingJobQueue();
    ids = new SequentialIdGenerator();
    actors = new InMemoryActorContext();
    actors.authenticate({
      userId: 'u',
      tenantId: 'tenant-a',
      membershipId: 'agent-1',
      sessionId: 's',
    });
    urls = { publicApiUrl: 'https://api.loja.com', webhooksReachable: true };
    contacts.contacts.set('c-1', {
      id: 'c-1',
      name: 'Maria',
      email: 'maria@exemplo.com',
      phone: '+5511987654321',
    });
    contacts.contacts.set('c-2', { id: 'c-2', name: 'Sem nada', email: null, phone: null });
    await providers.save(
      MessagingProvider.configure('prov-email', {
        tenantId: 'tenant-a',
        settings: {
          provider: 'sendgrid',
          fromEmail: 'vendas@loja.com',
          fromName: 'Loja',
          replyTo: null,
          eventWebhookKey: null,
        },
        secret: { sealed: cipher.seal('SG.key-0000000000000'), hint: '0000' },
      }),
    );
    await providers.save(
      MessagingProvider.configure('prov-sms', {
        tenantId: 'tenant-a',
        settings: {
          provider: 'twilio',
          accountSid: SID,
          from: '+15005550006',
          messagingServiceSid: null,
        },
        secret: { sealed: cipher.seal('twilio-token'), hint: 'oken' },
      }),
    );
  });

  const send = (input: {
    contactId?: string;
    channel: 'email' | 'sms';
    subject?: string;
    body?: string;
  }) =>
    new SendToContactUseCase(
      contacts,
      providers,
      optOuts,
      messages,
      jobs,
      actors,
      tenant,
      ids,
      uow,
    ).execute({
      contactId: 'c-1',
      subject: 'Proposta',
      body: 'Segue a proposta.',
      ...input,
    });
  const deliver = (id: string) =>
    new DeliverOutboundMessageUseCase(
      messages,
      providers,
      optOuts,
      clients,
      cipher,
      tokens,
      urls,
    ).execute(id);
  const stored = async (id: string) => (await messages.findById(id))!;

  describe('sending', () => {
    it('queues the message and the delivery job (never sends inline)', async () => {
      const message = await send({ channel: 'email' });
      expect(message).toMatchObject({
        status: 'queued',
        to: 'maria@exemplo.com',
        subject: 'Proposta',
        sentByMembershipId: 'agent-1',
      });
      expect(jobs.of(DeliverOutboundJob)).toEqual([{ messageId: message.id }]);
      expect(clients.emails).toEqual([]);
    });

    it('refuses without address, without provider, or when the contact opted out', async () => {
      await expect(send({ contactId: 'c-2', channel: 'sms' })).rejects.toThrow(
        ContactWithoutAddressError,
      );
      await providers.delete((await providers.findByChannel('sms'))!);
      await expect(send({ channel: 'sms' })).rejects.toThrow(MessagingNotConfiguredError);
      await optOuts.add({
        tenantId: 'tenant-a',
        channel: 'email',
        address: 'maria@exemplo.com',
        source: 'unsubscribe_link',
        createdAt: new Date(),
      });
      await expect(send({ channel: 'email' })).rejects.toThrow(OptedOutError);
      expect(jobs.jobs).toEqual([]);
    });

    it('lists and reactivates the contact opt-outs', async () => {
      await optOuts.add({
        tenantId: 'tenant-a',
        channel: 'sms',
        address: '+5511987654321',
        source: 'sms_reply',
        createdAt: new Date(),
      });
      const list = new ListContactOptOutsUseCase(contacts, optOuts);
      expect((await list.execute('c-1')).map((o) => [o.channel, o.source])).toEqual([
        ['sms', 'sms_reply'],
      ]);
      await new RemoveContactOptOutUseCase(contacts, optOuts).execute('c-1', 'sms');
      expect(await list.execute('c-1')).toEqual([]);
    });
  });

  describe('delivery (worker)', () => {
    it('email: sealed key opened, unsubscribe link signed for the address, our id in custom args', async () => {
      const message = await send({ channel: 'email' });
      await deliver(message.id);

      const [sent] = clients.emails;
      expect(sent.secret).toBe('SG.key-0000000000000');
      expect(sent.message.headers?.['List-Unsubscribe']).toBe(
        '<https://api.loja.com/v1/public/unsubscribe/unsub:tenant-a:email:maria@exemplo.com>',
      );
      expect(sent.message.customArgs).toEqual({ omni_message_id: message.id });
      expect(await stored(message.id)).toMatchObject({ status: 'sent', providerMessageId: 'sg-1' });

      // Job repetido não reenvia.
      await deliver(message.id);
      expect(clients.emails).toHaveLength(1);
    });

    it('SMS: status callback with our id only when the API is publicly reachable', async () => {
      const first = await send({ channel: 'sms', body: 'Oi Maria' });
      await deliver(first.id);
      expect(clients.sentSms[0].message).toEqual({
        to: '+5511987654321',
        body: 'Oi Maria',
        statusCallbackUrl: `https://api.loja.com/v1/public/webhooks/twilio/prov-sms/status?m=${first.id}`,
      });

      urls.webhooksReachable = false;
      const second = await send({ channel: 'sms' });
      await deliver(second.id);
      expect(clients.sentSms[1].message.statusCallbackUrl).toBeUndefined();
    });

    it('opted out while queued → failed without calling the provider', async () => {
      const message = await send({ channel: 'email' });
      await optOuts.add({
        tenantId: 'tenant-a',
        channel: 'email',
        address: 'maria@exemplo.com',
        source: 'provider',
        createdAt: new Date(),
      });
      await deliver(message.id);
      expect(clients.emails).toEqual([]);
      expect(await stored(message.id)).toMatchObject({
        status: 'failed',
        error: 'MESSAGING_OPTED_OUT',
      });
    });

    it('rejected = failed with the provider reason; unavailable = stays queued and retries; give up at the end', async () => {
      const rejected = await send({ channel: 'email' });
      clients.fail = new ProviderRejectedError('Sender not verified (HTTP 403)');
      await deliver(rejected.id);
      expect(await stored(rejected.id)).toMatchObject({
        status: 'failed',
        error: 'Sender not verified (HTTP 403)',
      });

      const flaky = await send({ channel: 'email' });
      clients.fail = new ProviderUnavailableError('tempo esgotado');
      await expect(deliver(flaky.id)).rejects.toThrow(ProviderUnavailableError);
      expect(await stored(flaky.id)).toMatchObject({ status: 'queued', error: 'tempo esgotado' });

      await new GiveUpOutboundMessageUseCase(messages).execute(flaky.id);
      expect((await stored(flaky.id)).status).toBe('failed');
      expect((await stored(flaky.id)).error).toContain('tempo esgotado');
    });
  });

  describe('provider webhooks', () => {
    const verifier = new FakeWebhookVerifier();
    const accept = () =>
      new AcceptProviderWebhookUseCase(providers, verifier, cipher, tenant, urls, jobs);

    it('Twilio status: verified with the account token and the exact URL, enqueued in its tenant', async () => {
      tenant.switchTo(null); // webhook chega sem sessão
      await accept().twilioStatus({
        providerId: 'prov-sms',
        requestUrl: '/v1/public/webhooks/twilio/prov-sms/status?m=id-1',
        query: { m: 'id-1' },
        params: { MessageStatus: 'undelivered', ErrorCode: '30006', ErrorMessage: 'Landline' },
        signature: 'good-signature',
      });
      expect(verifier.twilioCalls.at(-1)).toMatchObject({
        url: 'https://api.loja.com/v1/public/webhooks/twilio/prov-sms/status?m=id-1',
        authToken: 'twilio-token',
      });
      expect(tenant.tenantId).toBe('tenant-a');
      expect(jobs.of(ProviderEventsJob)).toEqual([
        { events: [{ messageId: 'id-1', status: 'failed', error: 'Twilio 30006: Landline' }] },
      ]);
    });

    it('rejects a bad signature, an unknown provider or a provider of the other channel', async () => {
      const base = { requestUrl: '/x', query: {}, params: {}, signature: 'good-signature' };
      await expect(
        accept().twilioStatus({ ...base, providerId: 'prov-sms', signature: 'forged' }),
      ).rejects.toThrow(WebhookRejected);
      await expect(accept().twilioStatus({ ...base, providerId: 'nope' })).rejects.toThrow(
        WebhookRejected,
      );
      await expect(accept().twilioInbound({ ...base, providerId: 'prov-email' })).rejects.toThrow(
        WebhookRejected,
      );
      expect(jobs.jobs).toEqual([]);
    });

    it('SendGrid: refused without the verification key configured', async () => {
      const input = {
        providerId: 'prov-email',
        rawBody: Buffer.from('[]'),
        timestamp: '1',
        signature: 'good-signature',
      };
      await expect(accept().sendgridEvents(input)).rejects.toThrow(WebhookRejected);

      const email = (await providers.findByChannel('email'))!;
      email.reconfigure({ ...(email.settings as EmailSettings), eventWebhookKey: 'A'.repeat(120) });
      await providers.save(email);
      const body = [{ event: 'delivered', omni_message_id: 'id-9', email: 'maria@exemplo.com' }];
      expect(
        await accept().sendgridEvents({ ...input, rawBody: Buffer.from(JSON.stringify(body)) }),
      ).toBe(1);
      expect(jobs.of(ProviderEventsJob)).toEqual([
        { events: [{ messageId: 'id-9', status: 'delivered' }] },
      ]);
    });

    it('translates SendGrid events (unknown ones ignored)', () => {
      const events = parseSendGridEvents(
        Buffer.from(
          JSON.stringify([
            { event: 'processed', omni_message_id: 'a' },
            { event: 'bounce', omni_message_id: 'a', reason: '550 no such user' },
            { event: 'open', omni_message_id: 'a' },
            { event: 'spamreport', omni_message_id: 'a', email: 'Maria@Exemplo.com' },
          ]),
        ),
      );
      expect(events).toEqual([
        { messageId: 'a', status: 'sent' },
        { messageId: 'a', status: 'bounced', error: '550 no such user' },
        {
          messageId: 'a',
          status: null,
          optOut: { channel: 'email', address: 'maria@exemplo.com' },
        },
      ]);
      expect(parseSendGridEvents(Buffer.from('not json'))).toEqual([]);
    });

    it('applies events idempotently and records provider opt-outs', async () => {
      const message = await send({ channel: 'email' });
      await deliver(message.id);
      const apply = new ApplyProviderEventsUseCase(messages, optOuts, tenant);
      await apply.execute([{ messageId: message.id, status: 'delivered' }]);
      await apply.execute([{ messageId: message.id, status: 'sent' }]); // atrasado
      await apply.execute([
        {
          messageId: null,
          status: null,
          optOut: { channel: 'email', address: 'maria@exemplo.com' },
        },
      ]);
      expect((await stored(message.id)).status).toBe('delivered');
      expect(await optOuts.isOptedOut('email', 'maria@exemplo.com')).toBe(true);
    });

    it('inbound "SAIR" opts the number out (enqueued, then recorded)', async () => {
      tenant.switchTo(null);
      await accept().twilioInbound({
        providerId: 'prov-sms',
        requestUrl: '/v1/public/webhooks/twilio/prov-sms/inbound',
        params: { From: '+5511987654321', Body: 'SAIR' },
        signature: 'good-signature',
      });
      const [sms] = jobs.of(InboundSmsJob);
      const record = new RecordInboundSmsUseCase(optOuts, tenant);
      await record.execute(sms);
      await record.execute({ from: '+5511900000000', body: 'Quero saber o preço' });
      expect(optOuts.items.map((o) => [o.address, o.source])).toEqual([
        ['+5511987654321', 'sms_reply'],
      ]);
    });
  });

  describe('unsubscribe link', () => {
    const unsubscribe = () => new UnsubscribeUseCase(tokens, optOuts, providers, tenant);

    it('GET only shows; POST opts out; a forged token is refused', async () => {
      tenant.switchTo(null);
      const token = tokens.create({
        tenantId: 'tenant-a',
        channel: 'email',
        address: 'maria@exemplo.com',
      });

      expect(await unsubscribe().inspect(token)).toMatchObject({
        senderName: 'Loja',
        alreadyOptedOut: false,
      });
      expect(optOuts.items).toEqual([]);
      expect(await unsubscribe().confirm(token)).toMatchObject({ alreadyOptedOut: true });
      expect(optOuts.items[0]).toMatchObject({
        address: 'maria@exemplo.com',
        source: 'unsubscribe_link',
      });
      expect(await unsubscribe().inspect('forjado')).toBeNull();
    });
  });
});
