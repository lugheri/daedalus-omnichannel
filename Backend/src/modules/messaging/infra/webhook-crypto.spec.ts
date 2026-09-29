import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { CryptoWebhookVerifier } from './crypto-webhook-verifier';
import { HmacUnsubscribeTokens } from './hmac-unsubscribe-tokens';

describe('Twilio webhook signature', () => {
  const verifier = new CryptoWebhookVerifier();
  const url = 'https://api.loja.com/v1/public/webhooks/twilio/p/status?m=1';
  const params = { MessageStatus: 'delivered', AccountSid: 'AC1', MessageSid: 'SM1' };
  // URL + parâmetros em ordem alfabética do nome (AccountSid, MessageSid, MessageStatus).
  const expected = createHmac('sha1', 'token')
    .update(`${url}AccountSidAC1MessageSidSM1MessageStatusdelivered`)
    .digest('base64');

  it('accepts the signature over URL + sorted params', () => {
    expect(verifier.twilio({ url, params, signature: expected, authToken: 'token' })).toBe(true);
  });

  it('refuses another token, a changed param, another URL or no signature', () => {
    expect(verifier.twilio({ url, params, signature: expected, authToken: 'outro' })).toBe(false);
    expect(
      verifier.twilio({
        url,
        params: { ...params, MessageStatus: 'failed' },
        signature: expected,
        authToken: 'token',
      }),
    ).toBe(false);
    expect(
      verifier.twilio({ url: `${url}0`, params, signature: expected, authToken: 'token' }),
    ).toBe(false);
    expect(verifier.twilio({ url, params, signature: undefined, authToken: 'token' })).toBe(false);
  });
});

describe('SendGrid signed event webhook', () => {
  const verifier = new CryptoWebhookVerifier();
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  // Como o SendGrid mostra a chave: base64 do DER (SPKI).
  const publicKeyB64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const rawBody = Buffer.from('[{"event":"delivered","omni_message_id":"m-1"}]');
  const timestamp = '1790000000';
  const signature = sign(
    'sha256',
    Buffer.concat([Buffer.from(timestamp), rawBody]),
    privateKey,
  ).toString('base64');

  it('accepts ECDSA over timestamp + raw body', () => {
    expect(verifier.sendgrid({ publicKey: publicKeyB64, timestamp, signature, rawBody })).toBe(
      true,
    );
  });

  it('refuses a changed body or timestamp, another key, or garbage', () => {
    expect(
      verifier.sendgrid({
        publicKey: publicKeyB64,
        timestamp,
        signature,
        rawBody: Buffer.from('[]'),
      }),
    ).toBe(false);
    expect(verifier.sendgrid({ publicKey: publicKeyB64, timestamp: '1', signature, rawBody })).toBe(
      false,
    );
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
      .publicKey.export({ format: 'der', type: 'spki' })
      .toString('base64');
    expect(verifier.sendgrid({ publicKey: other, timestamp, signature, rawBody })).toBe(false);
    expect(verifier.sendgrid({ publicKey: 'lixo', timestamp, signature, rawBody })).toBe(false);
  });
});

describe('Unsubscribe tokens', () => {
  const tokens = new HmacUnsubscribeTokens('a'.repeat(44));
  const target = { tenantId: 't-1', channel: 'email' as const, address: 'maria@exemplo.com' };

  it('round-trips and cannot be forged for another address', () => {
    const token = tokens.create(target);
    expect(tokens.verify(token)).toEqual(target);

    const [, signature] = token.split('.');
    const forgedData = Buffer.from(
      JSON.stringify({ t: 't-1', c: 'email', a: 'outro@x.com' }),
    ).toString('base64url');
    expect(tokens.verify(`${forgedData}.${signature}`)).toBeNull();
    expect(new HmacUnsubscribeTokens('b'.repeat(44)).verify(token)).toBeNull();
    expect(tokens.verify('lixo')).toBeNull();
  });
});
