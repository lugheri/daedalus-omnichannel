import type { AccessTokenClaims } from './access-token-issuer';

export interface AccessTokenVerifier {
  /** Claims do token, ou `null` se assinatura/validade/formato não conferirem. */
  verify(token: string): Promise<AccessTokenClaims | null>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol('AccessTokenVerifier');
