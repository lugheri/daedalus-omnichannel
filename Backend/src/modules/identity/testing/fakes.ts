import type {
  AccessTokenClaims,
  AccessTokenIssuer,
  IssuedAccessToken,
} from '../application/ports/access-token-issuer';
import type { PasswordHasher } from '../application/ports/password-hasher';
import type { RefreshSecretGenerator } from '../application/ports/refresh-secret-generator';
import type { RevokedSessionList } from '../application/ports/revoked-session-list';
import type { SessionRepository } from '../application/ports/session.repository';
import type { UserRepository } from '../application/ports/user.repository';
import type { Email } from '../domain/email.vo';
import { EmailAlreadyInUseError } from '../domain/errors/email-already-in-use.error';
import type { Session } from '../domain/session.entity';
import type { User } from '../domain/user.entity';

export class InMemoryUserRepository implements UserRepository {
  readonly users: User[] = [];

  save(user: User): Promise<void> {
    if (this.users.some((u) => u.id !== user.id && u.email.equals(user.email))) {
      throw new EmailAlreadyInUseError();
    }
    const index = this.users.findIndex((u) => u.id === user.id);
    if (index >= 0) this.users[index] = user;
    else this.users.push(user);
    return Promise.resolve();
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.find((u) => u.id === id) ?? null);
  }

  findByEmail(email: Email): Promise<User | null> {
    return Promise.resolve(this.users.find((u) => u.email.equals(email)) ?? null);
  }
}

export class InMemorySessionRepository implements SessionRepository {
  readonly sessions = new Map<string, Session>();

  save(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
    return Promise.resolve();
  }

  findById(id: string): Promise<Session | null> {
    return Promise.resolve(this.sessions.get(id) ?? null);
  }

  findUnrevokedByMembershipId(membershipId: string): Promise<Session[]> {
    return Promise.resolve(
      [...this.sessions.values()].filter(
        (s) => s.membershipId === membershipId && s.revokedAt === null,
      ),
    );
  }
}

/** "Hash" legível e reversível — só para testes. Conta as verificações. */
export class FakePasswordHasher implements PasswordHasher {
  verifications = 0;

  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }

  verify(hash: string, plain: string): Promise<boolean> {
    this.verifications++;
    return Promise.resolve(hash === `hashed:${plain}`);
  }
}

/** Segredos previsíveis: `secret-1`, `secret-2`... */
export class SequentialRefreshSecretGenerator implements RefreshSecretGenerator {
  private next = 1;

  generate(): string {
    return `secret-${this.next++}`;
  }

  hash(secret: string): string {
    return `hash(${secret})`;
  }
}

export class InMemoryRevokedSessionList implements RevokedSessionList {
  readonly revoked = new Set<string>();

  add(sessionId: string): Promise<void> {
    this.revoked.add(sessionId);
    return Promise.resolve();
  }

  has(sessionId: string): Promise<boolean> {
    return Promise.resolve(this.revoked.has(sessionId));
  }
}

/** Access token = claims serializadas, para o teste inspecionar. */
export class FakeAccessTokenIssuer implements AccessTokenIssuer {
  issue(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    return Promise.resolve({ token: JSON.stringify(claims), expiresInSeconds: 900 });
  }
}
