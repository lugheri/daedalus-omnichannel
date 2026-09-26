import { Email } from './email.vo';
import { InvalidEmailError } from './errors/invalid-email.error';
import { InvalidUserNameError } from './errors/invalid-user-name.error';
import { WeakPasswordError } from './errors/weak-password.error';
import { UserRegisteredEvent } from './events/user-registered.event';
import { Password } from './password.vo';
import { RefreshToken } from './refresh-token.vo';
import { User } from './user.entity';

describe('User', () => {
  it('registers with a normalized email and no platform role', () => {
    const user = User.register('user-1', {
      email: Email.create(' Ana@Example.COM '),
      name: ' Ana ',
      passwordHash: 'hash',
    });

    expect(user.email.value).toBe('ana@example.com');
    expect(user.name).toBe('Ana');
    expect(user.platformRole).toBeNull();
    expect(user.pullEvents()[0]).toBeInstanceOf(UserRegisteredEvent);
  });

  it('requires a name', () => {
    expect(() =>
      User.register('user-1', { email: Email.create('a@b.com'), name: '  ', passwordHash: 'h' }),
    ).toThrow(InvalidUserNameError);
  });

  it('rejects an invalid email', () => {
    expect(() => Email.create('not-an-email')).toThrow(InvalidEmailError);
  });
});

describe('Password', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(() => Password.create('1234567')).toThrow(WeakPasswordError);
  });

  it('never exposes the value when serialized', () => {
    const password = Password.create('super-secret');

    expect(String(password)).toBe('[redacted]');
    expect(JSON.stringify({ password })).toBe('{"password":"[redacted]"}');
  });
});

describe('RefreshToken', () => {
  it('round-trips through its string form', () => {
    const token = RefreshToken.parse(RefreshToken.compose('session-1', 'secret').toString());

    expect(token?.sessionId).toBe('session-1');
    expect(token?.secret).toBe('secret');
  });

  it.each(['', 'no-separator', '.secret', 'session.'])('rejects malformed token "%s"', (raw) => {
    expect(RefreshToken.parse(raw)).toBeNull();
  });
});
