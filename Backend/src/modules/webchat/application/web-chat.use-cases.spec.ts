import { FakeTenantContext } from '../../../shared/testing/fakes';
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
} from './web-chat.use-cases';

describe('Web chat (widget)', () => {
  let backend: FakeWebChatBackend;
  let tokens: FakeVisitorTokens;
  let tenant: FakeTenantContext;

  beforeEach(() => {
    backend = new FakeWebChatBackend();
    tokens = new FakeVisitorTokens();
    tenant = new FakeTenantContext(null);
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
    new StartVisitorSessionUseCase(backend, tokens, tenant).execute('chave-1', {
      phone: null,
      email: null,
      ...input,
    });

  it('the config comes by key; an unknown key is 404', async () => {
    const config = new GetWidgetConfigUseCase(backend);
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

  it('messages need a valid token, text and the widget id (kept for idempotency)', async () => {
    const { token } = await start({ name: 'Ana', phone: '11999998888' });
    const authenticate = new AuthenticateVisitorUseCase(tokens, tenant);
    expect(() => authenticate.execute(undefined)).toThrow(VisitorTokenInvalidError);
    expect(() => authenticate.execute('lixo')).toThrow(VisitorTokenInvalidError);

    const visitor = authenticate.execute(token);
    const send = new SendVisitorMessageUseCase(backend);
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
