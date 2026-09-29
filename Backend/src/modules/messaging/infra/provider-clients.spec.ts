import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ProviderRejectedError } from '../domain/errors/provider-rejected.error';
import { ProviderUnavailableError } from '../domain/errors/provider-unavailable.error';
import { SendGridClient } from './sendgrid.client';
import { TwilioSmsClient } from './twilio-sms.client';

interface Received {
  method?: string;
  url?: string;
  headers: IncomingMessage['headers'];
  body: string;
}

/**
 * Servidor local no lugar do SendGrid/Twilio: guarda o que chegou e responde
 * o que o teste mandar — confere o contrato HTTP dos clientes sem rede.
 */
describe('Provider HTTP clients (contract)', () => {
  let server: Server;
  let base: string;
  let received: Received[];
  let reply: { status: number; headers?: Record<string, string>; body?: unknown };

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => (body += chunk.toString()));
      req.on('end', () => {
        received.push({ method: req.method, url: req.url, headers: req.headers, body });
        res.writeHead(reply.status, { 'Content-Type': 'application/json', ...reply.headers });
        res.end(reply.body === undefined ? '' : JSON.stringify(reply.body));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    received = [];
  });

  const endpoints = () => ({ sendgridApiUrl: base, twilioApiUrl: base });

  describe('SendGrid', () => {
    const settings = {
      provider: 'sendgrid' as const,
      fromEmail: 'vendas@loja.com',
      fromName: 'Loja',
      replyTo: 'atendimento@loja.com',
      eventWebhookKey: null,
    };
    const send = () =>
      new SendGridClient(endpoints()).send(settings, 'SG.key', {
        to: 'cliente@exemplo.com',
        subject: 'Olá',
        text: 'Texto',
        html: '<p>Texto</p>',
      });

    it('posts the v3 mail/send payload with the bearer key and returns the message id', async () => {
      reply = { status: 202, headers: { 'X-Message-Id': 'sg-abc' } };
      expect(await send()).toEqual({ providerMessageId: 'sg-abc' });

      const [request] = received;
      expect(request).toMatchObject({ method: 'POST', url: '/v3/mail/send' });
      expect(request.headers.authorization).toBe('Bearer SG.key');
      expect(JSON.parse(request.body)).toEqual({
        personalizations: [{ to: [{ email: 'cliente@exemplo.com' }] }],
        from: { email: 'vendas@loja.com', name: 'Loja' },
        reply_to: { email: 'atendimento@loja.com' },
        subject: 'Olá',
        content: [
          { type: 'text/plain', value: 'Texto' },
          { type: 'text/html', value: '<p>Texto</p>' },
        ],
      });
    });

    it('4xx = rejected, with the provider message; 5xx/429 = unavailable', async () => {
      reply = {
        status: 403,
        body: {
          errors: [
            {
              message: 'The from address does not match a verified Sender Identity.',
              field: 'from',
            },
          ],
        },
      };
      await expect(send()).rejects.toThrow(ProviderRejectedError);
      await expect(send()).rejects.toMatchObject({
        reason: 'The from address does not match a verified Sender Identity. (from) (HTTP 403)',
      });

      reply = { status: 503 };
      await expect(send()).rejects.toThrow(ProviderUnavailableError);
      reply = { status: 429 };
      await expect(send()).rejects.toThrow(ProviderUnavailableError);
    });

    it('an unreachable provider is unavailable', async () => {
      const client = new SendGridClient({ sendgridApiUrl: 'http://127.0.0.1:1', twilioApiUrl: '' });
      await expect(
        client.send(settings, 'k', { to: 'a@b.com', subject: 's', text: 't' }),
      ).rejects.toThrow(ProviderUnavailableError);
    });
  });

  describe('Twilio SMS', () => {
    const sid = 'AC' + '1'.repeat(32);

    it('posts the form with basic auth (SID:token) from a number', async () => {
      reply = { status: 201, body: { sid: 'SM123', status: 'queued' } };
      const receipt = await new TwilioSmsClient(endpoints()).send(
        { provider: 'twilio', accountSid: sid, from: '+5511900000000', messagingServiceSid: null },
        'token',
        { to: '+5511987654321', body: 'Olá!' },
      );

      expect(receipt).toEqual({ providerMessageId: 'SM123' });
      const [request] = received;
      expect(request).toMatchObject({
        method: 'POST',
        url: `/2010-04-01/Accounts/${sid}/Messages.json`,
      });
      expect(request.headers.authorization).toBe(
        `Basic ${Buffer.from(`${sid}:token`).toString('base64')}`,
      );
      expect(Object.fromEntries(new URLSearchParams(request.body))).toEqual({
        To: '+5511987654321',
        Body: 'Olá!',
        From: '+5511900000000',
      });
    });

    it('uses the Messaging Service when configured, and reports Twilio errors', async () => {
      reply = { status: 201, body: { sid: 'SM1' } };
      const service = 'MG' + '2'.repeat(32);
      const client = new TwilioSmsClient(endpoints());
      await client.send(
        { provider: 'twilio', accountSid: sid, from: null, messagingServiceSid: service },
        'token',
        { to: '+5511987654321', body: 'x' },
      );
      expect(new URLSearchParams(received[0].body).get('MessagingServiceSid')).toBe(service);

      reply = { status: 401, body: { code: 20003, message: 'Authenticate' } };
      await expect(
        client.send(
          {
            provider: 'twilio',
            accountSid: sid,
            from: '+5511900000000',
            messagingServiceSid: null,
          },
          'wrong',
          { to: '+5511987654321', body: 'x' },
        ),
      ).rejects.toMatchObject({
        code: 'MESSAGING_PROVIDER_REJECTED',
        reason: 'Authenticate [20003] (HTTP 401)',
      });
    });
  });
});
