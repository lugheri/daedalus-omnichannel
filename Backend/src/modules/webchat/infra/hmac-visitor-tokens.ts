import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Visitor, VisitorTokens } from '../application/ports/visitor-tokens';
import { VISITOR_TOKEN_SETTINGS, type VisitorTokenSettings } from './visitor-token-settings';

interface Claims {
  v: 1;
  ch: string;
  tn: string;
  ct: string;
  nm: string;
  st: number;
  ex: number;
}

/**
 * `<payload base64url>.<HMAC-SHA256 base64url>`. A chave é derivada do
 * JWT_SECRET com um rótulo próprio: um token de visitante nunca vale como
 * access token (e vice-versa).
 */
@Injectable()
export class HmacVisitorTokens implements VisitorTokens {
  private readonly key: Buffer;

  constructor(@Inject(VISITOR_TOKEN_SETTINGS) private readonly settings: VisitorTokenSettings) {
    this.key = createHmac('sha256', settings.secret).update('web-chat-visitor-token').digest();
  }

  sign(visitor: Omit<Visitor, 'expiresAt'>): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + this.settings.tokenTtlMs);
    const claims: Claims = {
      v: 1,
      ch: visitor.channelId,
      tn: visitor.tenantId,
      ct: visitor.contactId,
      nm: visitor.name,
      st: visitor.since.getTime(),
      ex: expiresAt.getTime(),
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return { token: `${payload}.${this.signature(payload)}`, expiresAt };
  }

  verify(token: string): Visitor | null {
    if (token.length > 2_000) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) return null;
    const expected = Buffer.from(this.signature(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Claims;
      if (claims.v !== 1 || claims.ex < Date.now()) return null;
      return {
        channelId: claims.ch,
        tenantId: claims.tn,
        contactId: claims.ct,
        name: claims.nm,
        since: new Date(claims.st),
        expiresAt: new Date(claims.ex),
      };
    } catch {
      return null;
    }
  }

  private signature(payload: string): string {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }
}
