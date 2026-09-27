import type { AccessTokenClaims } from './access-token-issuer';

/** Claims de um token válido, mais quando ele expira. */
export type VerifiedAccessToken = AccessTokenClaims & { expiresAt: Date };

export interface AccessTokenVerifier {
  /** Claims do token, ou `null` se assinatura/validade/formato não conferirem. */
  verify(token: string): Promise<VerifiedAccessToken | null>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol('AccessTokenVerifier');
