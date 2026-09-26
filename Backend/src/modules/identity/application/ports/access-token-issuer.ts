/**
 * Claims do access token (ADR 0004): só identificadores. Permissões NÃO vão
 * no token — são resolvidas por requisição, para que revogar um acesso
 * tenha efeito imediato.
 */
export interface AccessTokenClaims {
  /** userId */
  sub: string;
  /** tenantId */
  tid: string;
  /** membershipId */
  mid: string;
  /** sessionId — permite revogar a sessão que originou o token */
  sid: string;
}

export interface IssuedAccessToken {
  token: string;
  expiresInSeconds: number;
}

export interface AccessTokenIssuer {
  issue(claims: AccessTokenClaims): Promise<IssuedAccessToken>;
}

export const ACCESS_TOKEN_ISSUER = Symbol('AccessTokenIssuer');
