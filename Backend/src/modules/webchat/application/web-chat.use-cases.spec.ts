import { FakeAccountStanding, FakeTenantContext } from '../../../shared/testing/fakes';
import { InvalidVisitorError } from '../domain/errors/invalid-visitor.error';
import { VisitorTokenInvalidError } from '../domain/errors/visitor-token-invalid.error';
import { WebChatNotFoundError } from '../domain/errors/web-chat-not-found.error';
import { WebChatUnavailableError } from '../domain/errors/web-chat-unavailable.error';
import { FakeVisitorTokens, FakeWebChatBackend } from '../testing/fakes';
import {
  AuthenticateVisitorUseCase,
  GetWidgetConfigUseCase,
  SendVisitorMessageUseCase,
  StartVisitorSessionUseCase,
  VisitorHistoryUseCase,
} from './web-chat.use-cases';

describe('Web chat (widget)', () => {
  let backend: FakeWebChatBackend;
  let tokens: FakeVisitorTokens;
  let tenant: FakeTenantContext;
  let standing: FakeAccountStanding;

  beforeEach(() => {
    backend = new FakeWebChatBackend();
    tokens = new FakeVisitorTokens();
    tenant = new FakeTenantContext(null);
    standing = new FakeAccountStanding();
    backend.channels.set('chave-1', {
      channelId: 'chat-1',
      tenantId: 'tenant-a',
      name: 'Site',
      title: 'Fale com a gente',
      greeting: 'Olá!',
      color: '#2f5bd7',
      active: true,
    });
  });

  const start = (input: { name: string; phone?: string | null; email?: string | null }) =>
    new StartVisitorSessionUseCase(backend, tokens, tenant, standing).execute('chave-1', {
      phone: null,
      email: null,
      ...input,
    });

  it('the config comes by key; an unknown key is 404', async () => {
    const config = new GetWidgetConfigUseCase(backend, standing);
    expect((await config.execute('chave-1')).title).toBe('Fale com a gente');
    await expect(config.execute('outra')).rejects.toThrow(WebChatNotFoundError);
  });

  it('a visitor gives a name and a phone or e-mail; the session is in the channel tenant', async () => {
    await expect(start({ name: ' ', phone: '11999998888' })).rejects.toThrow(InvalidVisitorError);
    await expect(start({ name: 'Ana' })).rejects.toMatchObject({
      code: 'WEB_CHAT_CONTACT_REQUIRED',
    });

    const session = await start({ name: ' Ana ', email: 'ana@exemplo.com' });
    expect(session.name).toBe('Ana');
    expect(tenant.tenantId).toBe('tenant-a');
    expect(backend.identified).toEqual([
      { name: 'Ana', phone: null, email: 'ana@exemplo.com', channelName: 'Site' },
    ]);
    const visitor = new AuthenticateVisitorUseCase(tokens, tenant).execute(session.token);
    expect(visitor).toMatchObject({
      channelId: 'chat-1',
      tenantId: 'tenant-a',
      contactId: 'contact-1',
    });
  });

  it('a turned-off chat takes no visitors', async () => {
    backend.channels.get('chave-1')!.active = false;
    await expect(start({ name: 'Ana', phone: '11999998888' })).rejects.toThrow(
      WebChatUnavailableError,
    );
  });

  it('a suspended account: the widget hides, no new visitor, no message, no history', async () => {
    const { token } = await start({ name: 'Ana', phone: '11999998888' });
    const visitor = new AuthenticateVisitorUseCase(tokens, tenant).execute(token);
    standing.suspended.add('tenant-a');

    expect((await new GetWidgetConfigUseCase(backend, standing).execute('chave-1')).active).toBe(
      false,
    );
    await expect(start({ name: 'Bia', phone: '11999997777' })).rejects.toThrow(
      WebChatUnavailableError,
    );
    expect(backend.identified).toHaveLength(1); // só a Ana, de antes da suspensão
    // O token de antes ainda é válido, mas a conta é conferida a cada mensagem.
    await expect(
      new SendVisitorMessageUseCase(backend, standing).execute(visitor, {
        id: 'f3b1c2d4-0000-4000-8000-000000000009',
        text: 'Oi',
      }),
    ).rejects.toThrow(WebChatUnavailableError);
    expect(backend.received).toEqual([]);
    await expect(new VisitorHistoryUseCase(backend, standing).execute(visitor)).rejects.toThrow(
      WebChatUnavailableError,
    );

    standing.suspended.delete('tenant-a');
    expect((await new GetWidgetConfigUseCase(backend, standing).execute('chave-1')).active).toBe(
      true,
    );
  });

  it('messages need a valid token, text and the widget id (kept for idempotency)', async () => {
    const { token } = await start({ name: 'Ana', phone: '11999998888' });
    const authenticate = new AuthenticateVisitorUseCase(tokens, tenant);
    expect(() => authenticate.execute(undefined)).toThrow(VisitorTokenInvalidError);
    expect(() => authenticate.execute('lixo')).toThrow(VisitorTokenInvalidError);

    const visitor = authenticate.execute(token);
    const send = new SendVisitorMessageUseCase(backend, standing);
    await send.execute(visitor, { id: 'f3b1c2d4-0000-4000-8000-000000000001', text: '  Oi!  ' });
    expect(backend.received).toEqual([
      expect.objectContaining({
        channelId: 'chat-1',
        contactId: 'contact-1',
        externalId: 'web-f3b1c2d4-0000-4000-8000-000000000001',
        text: 'Oi!',
      }),
    ]);
    await expect(send.execute(visitor, { id: 'x', text: 'Oi' })).rejects.toMatchObject({
      code: 'WEB_CHAT_INVALID_MESSAGE',
    });
    await expect(
      send.execute(visitor, { id: 'f3b1c2d4-0000-4000-8000-000000000002', text: '   ' }),
    ).rejects.toThrow(InvalidVisitorError);
  });
});
