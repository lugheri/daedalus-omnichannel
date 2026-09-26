import type { AuthTokens } from '../application/auth-tokens';

/**
 * Formato público do par de tokens. Exportado pelo index.ts: é o mesmo
 * contrato em todas as rotas que autenticam (cadastro, login, refresh).
 */
export const AuthTokensPresenter = {
  toHttp(tokens: AuthTokens) {
    return {
      tokenType: 'Bearer',
      accessToken: tokens.accessToken,
      expiresIn: tokens.accessTokenExpiresInSeconds,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
    };
  },
};
