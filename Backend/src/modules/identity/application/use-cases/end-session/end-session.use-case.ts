import { Inject, Injectable } from '@nestjs/common';
import { RefreshToken } from '../../../domain/refresh-token.vo';
import {
  REFRESH_SECRET_GENERATOR,
  type RefreshSecretGenerator,
} from '../../ports/refresh-secret-generator';
import { SESSION_REPOSITORY, type SessionRepository } from '../../ports/session.repository';

/**
 * Logout: revoga a sessão do refresh token apresentado.
 * Idempotente e silencioso — token inválido ou já revogado não gera erro,
 * para não servir de oráculo sobre quais tokens existem.
 */
@Injectable()
export class EndSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REFRESH_SECRET_GENERATOR) private readonly secrets: RefreshSecretGenerator,
  ) {}

  async execute(rawRefreshToken: string): Promise<void> {
    const presented = RefreshToken.parse(rawRefreshToken);
    if (!presented) return;

    const session = await this.sessions.findById(presented.sessionId);
    if (!session || session.refreshTokenHash !== this.secrets.hash(presented.secret)) return;

    session.revoke(new Date());
    await this.sessions.save(session);
  }
}
