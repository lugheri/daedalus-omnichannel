import { RecordingEventBus, SequentialIdGenerator } from '../../../../../shared/testing/fakes';
import { EmailAlreadyInUseError } from '../../../domain/errors/email-already-in-use.error';
import { WeakPasswordError } from '../../../domain/errors/weak-password.error';
import { UserRegisteredEvent } from '../../../domain/events/user-registered.event';
import { FakePasswordHasher, InMemoryUserRepository } from '../../../testing/fakes';
import { RegisterUserUseCase } from './register-user.use-case';

describe('RegisterUserUseCase', () => {
  let users: InMemoryUserRepository;
  let events: RecordingEventBus;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    events = new RecordingEventBus();
    useCase = new RegisterUserUseCase(
      users,
      new FakePasswordHasher(),
      new SequentialIdGenerator(),
      events,
    );
  });

  it('stores only the password hash, never the plain password', async () => {
    const user = await useCase.execute({
      email: 'ana@example.com',
      name: 'Ana',
      password: 'super-secret',
    });

    expect(user.passwordHash).toBe('hashed:super-secret');
    expect(JSON.stringify(users.users)).not.toContain('"super-secret"');
    expect(events.published[0]).toBeInstanceOf(UserRegisteredEvent);
  });

  it('rejects an email that is already registered, regardless of case', async () => {
    await useCase.execute({ email: 'ana@example.com', name: 'Ana', password: 'super-secret' });

    await expect(
      useCase.execute({ email: 'ANA@example.com', name: 'Ana 2', password: 'super-secret' }),
    ).rejects.toThrow(EmailAlreadyInUseError);
  });

  it('rejects a weak password before touching the repository', async () => {
    await expect(
      useCase.execute({ email: 'ana@example.com', name: 'Ana', password: '123' }),
    ).rejects.toThrow(WeakPasswordError);
    expect(users.users).toHaveLength(0);
  });
});
