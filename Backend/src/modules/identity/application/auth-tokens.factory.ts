import { Inject, Injectable } from '@nestjs/common';
import type { Session } from '../domain/session.entity';
import { RefreshToken } from '../domain/refresh-token.vo';
import type { AuthTokens } from './auth-tokens';
import { ACCESS_TOKEN_ISSUER, type AccessTokenIssuer } from './ports/access-token-issuer';

/** Monta o par de tokens de uma sessão. Usado no início da sessão e a cada refresh. */
@Injectable()
export class AuthTokensFactory {
  constructor(@Inject(ACCESS_TOKEN_ISSUER) private readonly accessTokens: AccessTokenIssuer) {}

  async create(session: Session, refreshSecret: string): Promise<AuthTokens> {
    const access = await this.accessTokens.issue({
      sub: session.userId,
      tid: session.tenantId,
      mid: session.membershipId,
      sid: session.id,
    });

    return {
      accessToken: access.token,
      accessTokenExpiresInSeconds: access.expiresInSeconds,
      refreshToken: RefreshToken.compose(session.id, refreshSecret).toString(),
      refreshTokenExpiresAt: session.expiresAt,
    };
  }
}
