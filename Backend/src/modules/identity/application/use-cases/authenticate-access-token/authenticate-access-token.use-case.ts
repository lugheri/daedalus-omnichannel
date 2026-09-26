import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../shared/application/actor-context';
import { InvalidAccessTokenError } from '../../../domain/errors/invalid-access-token.error';
import { ACCESS_TOKEN_VERIFIER, type AccessTokenVerifier } from '../../ports/access-token-verifier';

/**
 * Transforma o access token da requisição no ator autenticado.
 *
 * Verificação sem estado (só assinatura e validade): um token de uma sessão
 * encerrada segue válido até expirar (15 min). A checagem por requisição do
 * vínculo com o tenant — que torna a revogação de acesso imediata — entra
 * com o guard de permissões (ADR 0004).
 */
@Injectable()
export class AuthenticateAccessTokenUseCase {
  constructor(@Inject(ACCESS_TOKEN_VERIFIER) private readonly verifier: AccessTokenVerifier) {}

  async execute(token: string | undefined): Promise<Actor> {
    const claims = token ? await this.verifier.verify(token) : null;
    if (!claims) throw new InvalidAccessTokenError();

    return {
      userId: claims.sub,
      tenantId: claims.tid,
      membershipId: claims.mid,
      sessionId: claims.sid,
    };
  }
}
