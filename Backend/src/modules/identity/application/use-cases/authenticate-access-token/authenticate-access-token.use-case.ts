import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../shared/application/actor-context';
import { InvalidAccessTokenError } from '../../../domain/errors/invalid-access-token.error';
import { ACCESS_TOKEN_VERIFIER, type AccessTokenVerifier } from '../../ports/access-token-verifier';
import { REVOKED_SESSION_LIST, type RevokedSessionList } from '../../ports/revoked-session-list';

/**
 * Transforma o access token da requisição no ator autenticado: assinatura e
 * validade do JWT, mais a lista de sessões revogadas (logout e reuso de
 * refresh token valem na hora).
 *
 * Se o vínculo com o tenant continua ativo e quais permissões ele dá é
 * responsabilidade do guard de acesso do módulo accounts.
 */
export interface AuthenticatedAccess {
  actor: Actor;
  /** Quando o token expira (conexões longas, como o WebSocket, caem aí). */
  expiresAt: Date;
}

@Injectable()
export class AuthenticateAccessTokenUseCase {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly verifier: AccessTokenVerifier,
    @Inject(REVOKED_SESSION_LIST) private readonly revoked: RevokedSessionList,
  ) {}

  async execute(token: string | undefined): Promise<AuthenticatedAccess> {
    const claims = token ? await this.verifier.verify(token) : null;
    if (!claims || (await this.revoked.has(claims.sid))) throw new InvalidAccessTokenError();

    return {
      actor: {
        userId: claims.sub,
        tenantId: claims.tid,
        membershipId: claims.mid,
        sessionId: claims.sid,
      },
      expiresAt: claims.expiresAt,
    };
  }
}
