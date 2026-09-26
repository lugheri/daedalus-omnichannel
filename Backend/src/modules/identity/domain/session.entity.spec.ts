import { Session } from './session.entity';

describe('Session', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const inAMonth = new Date('2026-02-01T12:00:00Z');
  const next = { refreshTokenHash: 'hash-2', expiresAt: new Date('2026-03-01T12:00:00Z') };

  function startSession() {
    return Session.start('session-1', {
      userId: 'user-1',
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      refreshTokenHash: 'hash-1',
      expiresAt: inAMonth,
    });
  }

  it('rotates when the current secret is presented', () => {
    const session = startSession();

    expect(session.rotate('hash-1', next, now)).toBe('rotated');
    expect(session.refreshTokenHash).toBe('hash-2');
    expect(session.expiresAt).toEqual(next.expiresAt);
    expect(session.isActive(now)).toBe(true);
  });

  it('revokes the whole session when an old secret is reused', () => {
    const session = startSession();
    session.rotate('hash-1', next, now);

    expect(session.rotate('hash-1', next, now)).toBe('reuse-detected');
    expect(session.revokedAt).toEqual(now);
    expect(session.isActive(now)).toBe(false);
  });

  it('refuses to rotate an expired session', () => {
    const session = startSession();
    const afterExpiry = new Date('2026-02-02T00:00:00Z');

    expect(session.rotate('hash-1', next, afterExpiry)).toBe('inactive');
    expect(session.refreshTokenHash).toBe('hash-1');
  });

  it('refuses to rotate a revoked session, even with the right secret', () => {
    const session = startSession();
    session.revoke(now);

    expect(session.rotate('hash-1', next, now)).toBe('inactive');
  });

  it('keeps the first revocation time', () => {
    const session = startSession();
    session.revoke(now);
    session.revoke(inAMonth);

    expect(session.revokedAt).toEqual(now);
  });
});
