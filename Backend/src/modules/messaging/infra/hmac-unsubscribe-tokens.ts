import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { UnsubscribeTarget, UnsubscribeTokens } from '../application/ports/unsubscribe-tokens';

/**
 * Token do link de descadastro: `<dados em base64url>.<HMAC-SHA256>`. A chave
 * é derivada da ENCRYPTION_KEY (com um rótulo próprio, para não reusar a
 * mesma chave em dois usos). Não expira: um descadastro precisa funcionar
 * mesmo num e-mail antigo.
 */
export class HmacUnsubscribeTokens implements UnsubscribeTokens {
  private readonly key: Buffer;

  constructor(encryptionKey: string) {
    this.key = createHash('sha256').update(`unsubscribe-token:${encryptionKey}`).digest();
  }

  create(target: UnsubscribeTarget): string {
    const data = Buffer.from(
      JSON.stringify({ t: target.tenantId, c: target.channel, a: target.address }),
    ).toString('base64url');
    return `${data}.${this.sign(data)}`;
  }

  verify(token: string): UnsubscribeTarget | null {
    const [data, signature, extra] = token.split('.');
    if (!data || !signature || extra !== undefined) return null;
    const expected = Buffer.from(this.sign(data));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const { t, c, a } = JSON.parse(Buffer.from(data, 'base64url').toString()) as {
        t?: string;
        c?: string;
        a?: string;
      };
      if (!t || !a || (c !== 'email' && c !== 'sms')) return null;
      return { tenantId: t, channel: c, address: a };
    } catch {
      return null;
    }
  }

  private sign(data: string): string {
    return createHmac('sha256', this.key).update(data).digest('base64url');
  }
}
