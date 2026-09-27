import { SequentialIdGenerator } from '../../../../../shared/testing/fakes';
import { InvalidRefreshTokenError } from '../../../domain/errors/invalid-refresh-token.error';
import {
  FakeAccessTokenIssuer,
  InMemoryRevokedSessionList,
  InMemorySessionRepository,
  SequentialRefreshSecretGenerator,
} from '../../../testing/fakes';
import { AuthTokensFactory } from '../../auth-tokens.factory';
import { EndSessionUseCase } from '../end-session/end-session.use-case';
import { StartSessionUseCase } from '../start-session/start-session.use-case';
import { RefreshSessionUseCase } from './refresh-session.use-case';

describe('Session lifecycle (start → refresh → logout)', () => {
  let sessions: InMemorySessionRepository;
  let start: StartSessionUseCase;
  let refresh: RefreshSessionUseCase;
  let end: EndSessionUseCase;
  let revoked: InMemoryRevokedSessionList;

  beforeEach(() => {
    sessions = new InMemorySessionRepository();
    revoked = new InMemoryRevokedSessionList();
    const secrets = new SequentialRefreshSecretGenerator();
    const settings = { accessTokenTtlSeconds: 900, refreshTokenTtlDays: 30, secureCookies: true };
    const tokens = new AuthTokensFactory(new FakeAccessTokenIssuer());

    start = new StartSessionUseCase(
      sessions,
      secrets,
      new SequentialIdGenerator(),
      settings,
      tokens,
    );
    refresh = new RefreshSessionUseCase(sessions, secrets, revoked, settings, tokens);
    end = new EndSessionUseCase(sessions, secrets, revoked, settings);
  });

  it('logout also invalidates the access tokens of the session', async () => {
    const tokens = await startSession();

    await end.execute(tokens.refreshToken);

    expect(revoked.revoked.has('id-1')).toBe(true);
  });

  it('refresh-token reuse also invalidates the access tokens of the session', async () => {
    const first = await startSession();
    await refresh.execute(first.refreshToken);

    await expect(refresh.execute(first.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
    expect(revoked.revoked.has('id-1')).toBe(true);
  });

  it('a normal rotation does not revoke anything', async () => {
    const first = await startSession();
    await refresh.execute(first.refreshToken);

    expect(revoked.revoked.size).toBe(0);
  });

  const startSession = () =>
    start.execute({ userId: 'user-1', tenantId: 'tenant-1', membershipId: 'membership-1' });

  it('issues an access token scoped to the tenant and membership', async () => {
    const tokens = await startSession();

    expect(JSON.parse(tokens.accessToken)).toEqual({
      sub: 'user-1',
      tid: 'tenant-1',
      mid: 'membership-1',
      sid: 'id-1',
    });
    expect(tokens.refreshToken).toBe('id-1.secret-1');
  });

  it('stores only the hash of the refresh secret', async () => {
    await startSession();

    expect(sessions.sessions.get('id-1')?.refreshTokenHash).toBe('hash(secret-1)');
  });

  it('rotates the refresh token on each use', async () => {
    const first = await startSession();
    const second = await refresh.execute(first.refreshToken);

    expect(second.refreshToken).toBe('id-1.secret-2');
    expect(second.refreshToken).not.toBe(first.refreshToken);
  });

  it('revokes the session when an already-used refresh token comes back', async () => {
    const first = await startSession();
    const second = await refresh.execute(first.refreshToken);

    await expect(refresh.execute(first.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
    // O token legítimo mais recente também deixa de funcionar.
    await expect(refresh.execute(second.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it.each(['garbage', 'unknown-session.secret-1', ''])(
    'rejects an invalid refresh token (%s)',
    async (raw) => {
      await startSession();
      await expect(refresh.execute(raw)).rejects.toThrow(InvalidRefreshTokenError);
    },
  );

  it('logout revokes the session', async () => {
    const tokens = await startSession();

    await end.execute(tokens.refreshToken);

    await expect(refresh.execute(tokens.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('logout with a bogus token is a silent no-op', async () => {
    await expect(end.execute('id-1.not-the-secret')).resolves.toBeUndefined();
    await expect(end.execute('garbage')).resolves.toBeUndefined();
  });
});
