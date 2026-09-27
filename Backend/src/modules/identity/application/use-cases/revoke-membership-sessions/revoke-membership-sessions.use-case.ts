import { Inject, Injectable } from '@nestjs/common';
import { IDENTITY_SETTINGS, type IdentitySettings } from '../../ports/identity-settings';
import { REVOKED_SESSION_LIST, type RevokedSessionList } from '../../ports/revoked-session-list';
import { SESSION_REPOSITORY, type SessionRepository } from '../../ports/session.repository';

/**
 * Derruba todas as sessões de um vínculo (pessoa desativada numa conta):
 * o refresh token para de funcionar e os access tokens em circulação são
 * recusados na hora. Sessões da mesma pessoa em OUTRAS contas não mudam.
 */
@Injectable()
export class RevokeMembershipSessionsUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REVOKED_SESSION_LIST) private readonly revoked: RevokedSessionList,
    @Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
  ) {}

  async execute(membershipId: string): Promise<number> {
    const now = new Date();
    const sessions = await this.sessions.findUnrevokedByMembershipId(membershipId);

    for (const session of sessions) {
      session.revoke(now);
      await this.sessions.save(session);
      await this.revoked.add(session.id, this.settings.accessTokenTtlSeconds);
    }
    return sessions.length;
  }
}
