import {
  FakeSecretCipher,
  FakeTenantContext,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { InvalidMessagingSettingsError } from '../../domain/errors/invalid-messaging-settings.error';
import { MessagingNotConfiguredError } from '../../domain/errors/messaging-not-configured.error';
import { ProviderRejectedError } from '../../domain/errors/provider-rejected.error';
import type { ProviderSettings } from '../../domain/messaging-provider.entity';
import { FakeProviderClients, InMemoryMessagingProviderRepository } from '../../testing/fakes';
import {
  ListMessagingProvidersUseCase,
  RemoveMessagingProviderUseCase,
  SaveMessagingProviderUseCase,
  SendTestMessageUseCase,
} from './messaging-settings.use-cases';

const SID = 'AC' + 'a'.repeat(32);
const SERVICE = 'MG' + 'b'.repeat(32);
const email = (over: Partial<Extract<ProviderSettings, { provider: 'sendgrid' }>> = {}) => ({
  provider: 'sendgrid' as const,
  fromEmail: ' Vendas@Loja.com.br ',
  fromName: '  Loja   Exemplo ',
  replyTo: null,
  ...over,
});
const sms = (over: Partial<Extract<ProviderSettings, { provider: 'twilio' }>> = {}) => ({
  provider: 'twilio' as const,
  accountSid: SID,
  from: '11987654321',
  messagingServiceSid: null,
  ...over,
});

/** O código do erro de domínio da promessa rejeitada. */
const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: { code?: string }) => error.code,
  );

describe('Messaging providers (setup)', () => {
  let tenant: FakeTenantContext;
  let providers: InMemoryMessagingProviderRepository;
  let clients: FakeProviderClients;
  let ids: SequentialIdGenerator;
  const cipher = new FakeSecretCipher();

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    providers = new InMemoryMessagingProviderRepository(tenant);
    clients = new FakeProviderClients();
    ids = new SequentialIdGenerator();
  });

  const save = (settings: ProviderSettings, secret?: string) =>
    new SaveMessagingProviderUseCase(providers, cipher, tenant, ids).execute({ settings, secret });
  const test = (channel: 'email' | 'sms', to: string) =>
    new SendTestMessageUseCase(providers, clients, cipher).execute({ channel, to });

  it('saves the email provider tidy, with the key sealed and only its end visible', async () => {
    const provider = await save(email(), '  SG.chave-super-secreta-1234  ');

    expect(provider.settings).toEqual({
      provider: 'sendgrid',
      fromEmail: 'vendas@loja.com.br',
      fromName: 'Loja Exemplo',
      replyTo: null,
    });
    expect(provider.secret.hint).toBe('1234');
    expect(provider.secret.sealed).not.toContain('chave-super-secreta');
    expect(cipher.open(provider.secret.sealed)).toBe('SG.chave-super-secreta-1234');
    expect(provider.status).toBe('unverified');
  });

  it('the secret is required the first time; later, absent keeps the saved one', async () => {
    await expect(save(email())).rejects.toMatchObject({ code: 'MESSAGING_SECRET_REQUIRED' });
    const first = await save(email(), 'SG.primeira-chave-0001');
    const updated = await save(email({ fromName: 'Outro nome' }));
    expect(updated.id).toBe(first.id);
    expect(updated.secret.hint).toBe('0001');
    expect(updated.settings).toMatchObject({ fromName: 'Outro nome' });
  });

  it('validates the settings', async () => {
    const secret = 'SG.chave-valida-000000';
    expect(await codeOf(save(email({ fromEmail: 'nao-e-email' }), secret))).toBe(
      'MESSAGING_INVALID_FROM_EMAIL',
    );
    expect(await codeOf(save(email({ fromName: '  ' }), secret))).toBe(
      'MESSAGING_INVALID_FROM_NAME',
    );
    expect(await codeOf(save(email({ replyTo: 'x' }), secret))).toBe('MESSAGING_INVALID_REPLY_TO');
    expect(await codeOf(save(email(), 'curta'))).toBe('MESSAGING_INVALID_SECRET');

    const token = 'f'.repeat(32);
    expect(await codeOf(save(sms({ accountSid: 'AC123' }), token))).toBe(
      'MESSAGING_INVALID_ACCOUNT_SID',
    );
    // Exatamente um remetente: número OU Messaging Service.
    expect(await codeOf(save(sms({ from: null }), token))).toBe('MESSAGING_INVALID_SENDER');
    expect(await codeOf(save(sms({ messagingServiceSid: SERVICE }), token))).toBe(
      'MESSAGING_INVALID_SENDER',
    );
    expect(await codeOf(save(sms({ from: '123' }), token))).toBe('MESSAGING_INVALID_SENDER');
  });

  it('SMS from a number (normalized to E.164) or from a Messaging Service', async () => {
    const token = 'f'.repeat(32);
    expect((await save(sms(), token)).settings).toMatchObject({ from: '+5511987654321' });
    expect((await save(sms({ from: null, messagingServiceSid: SERVICE }))).settings).toMatchObject({
      from: null,
      messagingServiceSid: SERVICE,
    });
  });

  it('one provider per channel, per account', async () => {
    await save(email(), 'SG.chave-valida-000000');
    await save(sms(), 'f'.repeat(32));
    expect(
      (await new ListMessagingProvidersUseCase(providers).execute()).map((p) => p.channel).sort(),
    ).toEqual(['email', 'sms']);
    tenant.switchTo('tenant-b');
    expect(await new ListMessagingProvidersUseCase(providers).execute()).toEqual([]);
  });

  describe('test message', () => {
    it('sends with the opened secret and marks the provider as verified', async () => {
      await save(email(), 'SG.chave-valida-000000');
      const provider = await test('email', ' Eu@Exemplo.com ');

      expect(clients.emails).toHaveLength(1);
      expect(clients.emails[0].secret).toBe('SG.chave-valida-000000');
      expect(clients.emails[0].message.to).toBe('eu@exemplo.com');
      expect(provider.status).toBe('verified');
      expect(provider.lastCheckedAt).not.toBeNull();
    });

    it('a rejection is stored (status failing + the provider message) and reported', async () => {
      await save(sms(), 'f'.repeat(32));
      clients.fail = new ProviderRejectedError(
        "The 'From' number is not a valid phone number [21212] (HTTP 400)",
      );

      await expect(test('sms', '11 98765-4321')).rejects.toThrow(ProviderRejectedError);
      const [stored] = await providers.list();
      expect(stored.status).toBe('failing');
      expect(stored.lastError).toContain('21212');

      // Corrigir a configuração volta para "não verificado".
      clients.fail = null;
      expect((await save(sms({ from: '11 91234-5678' }))).status).toBe('unverified');
      expect((await test('sms', '11 98765-4321')).status).toBe('verified');
      expect(clients.sentSms.at(-1)?.message.to).toBe('+5511987654321');
    });

    it('a bad recipient is the typist’s error, not the configuration’s', async () => {
      await save(email(), 'SG.chave-valida-000000');
      await expect(test('email', 'nao-e-email')).rejects.toThrow(InvalidMessagingSettingsError);
      expect((await providers.list())[0].status).toBe('unverified');
    });

    it('needs a configured provider', async () => {
      await expect(test('sms', '11987654321')).rejects.toThrow(MessagingNotConfiguredError);
      await expect(new RemoveMessagingProviderUseCase(providers).execute('sms')).rejects.toThrow(
        MessagingNotConfiguredError,
      );
    });
  });
});
