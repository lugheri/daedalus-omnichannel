import { Session } from '../../../domain/session.entity';
import { InMemoryRevokedSessionList, InMemorySessionRepository } from '../../../testing/fakes';
import { RevokeSessionUseCase } from './revoke-session.use-case';

describe('RevokeSessionUseCase', () => {
  const settings = { accessTokenTtlSeconds: 900, refreshTokenTtlDays: 30, secureCookies: true };

  function session(id: string) {
    return Session.start(id, {
      userId: 'user-1',
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      refreshTokenHash: 'hash',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
  }

  it('revokes only that session, also for its access tokens', async () => {
    const sessions = new InMemorySessionRepository();
    const revoked = new InMemoryRevokedSessionList();
    await sessions.save(session('s-1'));
    await sessions.save(session('s-2')); // outra aba/aparelho da mesma pessoa

    await new RevokeSessionUseCase(sessions, revoked, settings).execute('s-1');

    expect([...revoked.revoked]).toEqual(['s-1']);
    expect((await sessions.findById('s-1'))?.revokedAt).not.toBeNull();
    expect((await sessions.findById('s-2'))?.revokedAt).toBeNull();
  });

  it('is idempotent and silent for an unknown session', async () => {
    const sessions = new InMemorySessionRepository();
    const revoked = new InMemoryRevokedSessionList();
    await sessions.save(session('s-1'));
    const useCase = new RevokeSessionUseCase(sessions, revoked, settings);

    await useCase.execute('s-1');
    const first = (await sessions.findById('s-1'))?.revokedAt;
    await useCase.execute('s-1');
    await useCase.execute('missing');

    expect((await sessions.findById('s-1'))?.revokedAt).toEqual(first);
  });
});
