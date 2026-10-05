import { Inject, Injectable } from '@nestjs/common';
import { IDENTITY_SETTINGS, type IdentitySettings } from '../../ports/identity-settings';
import { REVOKED_SESSION_LIST, type RevokedSessionList } from '../../ports/revoked-session-list';
import { SESSION_REPOSITORY, type SessionRepository } from '../../ports/session.repository';

/**
 * Encerra uma sessão pelo id — que vem de um access token já validado (ex.:
 * troca de conta encerra a sessão da conta anterior). Como o logout, também
 * recusa na hora os access tokens dela. Idempotente.
 */
@Injectable()
export class RevokeSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REVOKED_SESSION_LIST) private readonly revoked: RevokedSessionList,
    @Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
  ) {}

  async execute(sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (!session) return;

    if (!session.revokedAt) {
      session.revoke(new Date());
      await this.sessions.save(session);
    }
    await this.revoked.add(session.id, this.settings.accessTokenTtlSeconds);
  }
}
