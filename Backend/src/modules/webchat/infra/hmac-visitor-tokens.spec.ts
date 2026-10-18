import { HmacVisitorTokens } from './hmac-visitor-tokens';

describe('HmacVisitorTokens', () => {
  const visitor = {
    channelId: 'chat-1',
    tenantId: 'tenant-a',
    contactId: 'contact-1',
    name: 'Ana',
    since: new Date('2030-01-01T10:00:00Z'),
  };

  it('signs and verifies; tampering or another secret is refused', () => {
    const tokens = new HmacVisitorTokens({ secret: 'segredo-de-teste', tokenTtlMs: 60_000 });
    const { token } = tokens.sign(visitor);
    expect(tokens.verify(token)).toMatchObject(visitor);

    const [payload, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<
      string,
      unknown
    >;
    const forged = Buffer.from(JSON.stringify({ ...claims, ct: 'contact-2' })).toString(
      'base64url',
    );
    expect(tokens.verify(`${forged}.${signature}`)).toBeNull();
    expect(tokens.verify(`${payload}.`)).toBeNull();
    expect(tokens.verify('abc')).toBeNull();
    expect(new HmacVisitorTokens({ secret: 'outro', tokenTtlMs: 60_000 }).verify(token)).toBeNull();
  });

  it('refuses expired tokens', () => {
    const tokens = new HmacVisitorTokens({ secret: 's', tokenTtlMs: -1 });
    expect(tokens.verify(tokens.sign(visitor).token)).toBeNull();
  });
});
