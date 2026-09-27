import { Session } from '../../../domain/session.entity';
import { InMemoryRevokedSessionList, InMemorySessionRepository } from '../../../testing/fakes';
import { RevokeMembershipSessionsUseCase } from './revoke-membership-sessions.use-case';

describe('RevokeMembershipSessionsUseCase', () => {
  const settings = { accessTokenTtlSeconds: 900, refreshTokenTtlDays: 30, secureCookies: true };

  function session(id: string, membershipId: string) {
    return Session.start(id, {
      userId: 'user-1',
      tenantId: 'tenant-1',
      membershipId,
      refreshTokenHash: 'hash',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
  }

  it('revokes every session of the membership, and only of it', async () => {
    const sessions = new InMemorySessionRepository();
    const revoked = new InMemoryRevokedSessionList();
    await sessions.save(session('s-1', 'membership-a'));
    await sessions.save(session('s-2', 'membership-a'));
    await sessions.save(session('s-3', 'membership-b')); // mesma pessoa, outra conta

    const count = await new RevokeMembershipSessionsUseCase(sessions, revoked, settings).execute(
      'membership-a',
    );

    expect(count).toBe(2);
    expect([...revoked.revoked]).toEqual(['s-1', 's-2']);
    expect((await sessions.findById('s-1'))?.revokedAt).not.toBeNull();
    expect((await sessions.findById('s-3'))?.revokedAt).toBeNull();
  });
});
