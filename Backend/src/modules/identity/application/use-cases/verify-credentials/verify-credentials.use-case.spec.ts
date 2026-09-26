import { Email } from '../../../domain/email.vo';
import { InvalidCredentialsError } from '../../../domain/errors/invalid-credentials.error';
import { User } from '../../../domain/user.entity';
import { FakePasswordHasher, InMemoryUserRepository } from '../../../testing/fakes';
import { VerifyCredentialsUseCase } from './verify-credentials.use-case';

describe('VerifyCredentialsUseCase', () => {
  let hasher: FakePasswordHasher;
  let useCase: VerifyCredentialsUseCase;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    useCase = new VerifyCredentialsUseCase(users, hasher);

    await users.save(
      User.register('user-1', {
        email: Email.create('ana@example.com'),
        name: 'Ana',
        passwordHash: 'hashed:super-secret',
      }),
    );
  });

  it('returns the user for valid credentials (email is case-insensitive)', async () => {
    const user = await useCase.execute({ email: 'ANA@example.com', password: 'super-secret' });

    expect(user.id).toBe('user-1');
  });

  it('rejects a wrong password', async () => {
    await expect(
      useCase.execute({ email: 'ana@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects an unknown email with the same error, still checking a hash', async () => {
    await expect(
      useCase.execute({ email: 'nobody@example.com', password: 'super-secret' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(hasher.verifications).toBe(1);
  });

  it('treats a malformed email as invalid credentials', async () => {
    await expect(useCase.execute({ email: 'not-an-email', password: 'x' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });
});
