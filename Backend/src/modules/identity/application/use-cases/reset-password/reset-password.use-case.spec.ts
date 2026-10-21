import { ImmediateUnitOfWork } from '../../../../../shared/testing/fakes';
import { Email } from '../../../domain/email.vo';
import { InvalidEmailError } from '../../../domain/errors/invalid-email.error';
import { UserNotFoundError } from '../../../domain/errors/user-not-found.error';
import { WeakPasswordError } from '../../../domain/errors/weak-password.error';
import { Session } from '../../../domain/session.entity';
import { User } from '../../../domain/user.entity';
import {
  FakePasswordHasher,
  InMemoryRevokedSessionList,
  InMemorySessionRepository,
  InMemoryUserRepository,
} from '../../../testing/fakes';
import { ResetPasswordUseCase } from './reset-password.use-case';

describe('ResetPasswordUseCase', () => {
  const settings = { accessTokenTtlSeconds: 900, refreshTokenTtlDays: 30, secureCookies: true };
  let users: InMemoryUserRepository;
  let sessions: InMemorySessionRepository;
  let hasher: FakePasswordHasher;
  let revoked: InMemoryRevokedSessionList;
  let unitOfWork: ImmediateUnitOfWork;
  let temporary: string;

  const useCase = () =>
    new ResetPasswordUseCase(
      users,
      sessions,
      hasher,
      { generate: () => temporary },
      revoked,
      settings,
      unitOfWork,
    );

  function session(id: string, userId: string, tenantId: string) {
    return Session.start(id, {
      userId,
      tenantId,
      membershipId: `m-${tenantId}-${userId}`,
      refreshTokenHash: 'hash',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
  }

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    sessions = new InMemorySessionRepository();
    hasher = new FakePasswordHasher();
    revoked = new InMemoryRevokedSessionList();
    unitOfWork = new ImmediateUnitOfWork();
    temporary = 'Temporaria2026Forte';
    await users.save(
      User.register('user-1', {
        email: Email.create('ana@empresa.com'),
        name: 'Ana',
        passwordHash: 'hashed:antiga-senha',
      }),
    );
    await users.save(
      User.register('user-2', {
        email: Email.create('bia@empresa.com'),
        name: 'Bia',
        passwordHash: 'hashed:senha-da-bia',
      }),
    );
  });

  it('stores the hash of a new temporary password and returns it once', async () => {
    const result = await useCase().execute('Ana@Empresa.com');

    expect(result).toMatchObject({
      userId: 'user-1',
      email: 'ana@empresa.com',
      temporaryPassword: 'Temporaria2026Forte',
    });
    const ana = await users.findById('user-1');
    expect(ana!.passwordHash).toBe('hashed:Temporaria2026Forte');
    expect(await hasher.verify(ana!.passwordHash, 'antiga-senha')).toBe(false);
    expect(unitOfWork.runs).toBe(1);
  });

  it('revokes every open session of the person, in every account, and only hers', async () => {
    await sessions.save(session('s-1', 'user-1', 'tenant-a'));
    await sessions.save(session('s-2', 'user-1', 'tenant-b'));
    await sessions.save(session('s-3', 'user-2', 'tenant-a'));

    const { revokedSessions } = await useCase().execute('ana@empresa.com');

    expect(revokedSessions).toBe(2);
    expect([...revoked.revoked]).toEqual(['s-1', 's-2']);
    expect((await sessions.findById('s-1'))?.revokedAt).not.toBeNull();
    expect((await sessions.findById('s-2'))?.revokedAt).not.toBeNull();
    expect((await sessions.findById('s-3'))?.revokedAt).toBeNull();
  });

  it('refuses an unknown e-mail without touching anything', async () => {
    await expect(useCase().execute('ninguem@empresa.com')).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
    expect((await users.findById('user-1'))!.passwordHash).toBe('hashed:antiga-senha');
  });

  it('refuses a malformed e-mail', async () => {
    await expect(useCase().execute('nao-e-email')).rejects.toBeInstanceOf(InvalidEmailError);
  });

  it('never stores a password outside the password rules', async () => {
    temporary = 'curta';
    await expect(useCase().execute('ana@empresa.com')).rejects.toBeInstanceOf(WeakPasswordError);
    expect((await users.findById('user-1'))!.passwordHash).toBe('hashed:antiga-senha');
  });
});
