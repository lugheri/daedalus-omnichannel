import { Injectable } from '@nestjs/common';
import { createHmac, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import type { WebhookVerifier } from '../application/ports/webhook-verifier';

/**
 * Assinaturas dos webhooks, conforme a documentação de cada provedor:
 * - Twilio: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 * - SendGrid: https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
@Injectable()
export class CryptoWebhookVerifier implements WebhookVerifier {
  twilio(input: {
    url: string;
    params: Record<string, string>;
    signature: string | undefined;
    authToken: string;
  }): boolean {
    if (!input.signature) return false;
    // URL completa + cada parâmetro POST (nome e valor), em ordem alfabética do nome.
    const payload =
      input.url +
      Object.keys(input.params)
        .sort()
        .map((name) => name + input.params[name])
        .join('');
    const expected = createHmac('sha1', input.authToken).update(payload).digest();
    const given = Buffer.from(input.signature, 'base64');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  sendgrid(input: {
    publicKey: string;
    timestamp: string | undefined;
    signature: string | undefined;
    rawBody: Buffer;
  }): boolean {
    if (!input.timestamp || !input.signature) return false;
    try {
      // A chave vem do SendGrid como base64 do DER (SubjectPublicKeyInfo).
      const key = createPublicKey({
        key: Buffer.from(input.publicKey, 'base64'),
        format: 'der',
        type: 'spki',
      });
      return verify(
        'sha256',
        Buffer.concat([Buffer.from(input.timestamp), input.rawBody]),
        key,
        Buffer.from(input.signature, 'base64'),
      );
    } catch {
      return false;
    }
  }
}
