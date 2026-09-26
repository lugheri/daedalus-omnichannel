import type { AuthTokens } from '../application/auth-tokens';

/**
 * Corpo público das rotas que autenticam (cadastro, login, refresh).
 * O refresh token NÃO aparece aqui: vai no cookie HttpOnly (RefreshTokenCookie).
 * Exportado pelo index.ts para manter o mesmo contrato em todas elas.
 */
export const AuthTokensPresenter = {
  toHttp(tokens: AuthTokens) {
    return {
      tokenType: 'Bearer',
      accessToken: tokens.accessToken,
      expiresIn: tokens.accessTokenExpiresInSeconds,
    };
  },
};
