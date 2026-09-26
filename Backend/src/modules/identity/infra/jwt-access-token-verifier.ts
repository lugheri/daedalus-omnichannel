import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import type { AccessTokenClaims } from '../application/ports/access-token-issuer';
import type { AccessTokenVerifier } from '../application/ports/access-token-verifier';

/** Um token com assinatura válida mas sem estas claims não é nosso access token. */
const claimsSchema = z.object({
  sub: z.uuid(),
  tid: z.uuid(),
  mid: z.uuid(),
  sid: z.uuid(),
});

@Injectable()
export class JwtAccessTokenVerifier implements AccessTokenVerifier {
  constructor(private readonly jwt: JwtService) {}

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      // Algoritmo fixado no JwtModule (HS256): tokens "alg: none" ou com
      // outro algoritmo são recusados aqui.
      const payload: unknown = await this.jwt.verifyAsync(token);
      const claims = claimsSchema.safeParse(payload);
      return claims.success ? claims.data : null;
    } catch {
      return null;
    }
  }
}
