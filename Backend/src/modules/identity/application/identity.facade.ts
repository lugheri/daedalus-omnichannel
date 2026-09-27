import { Inject, Injectable } from '@nestjs/common';
import { Email } from '../domain/email.vo';
import type { AuthTokens } from './auth-tokens';
import { USER_REPOSITORY, type UserRepository } from './ports/user.repository';
import { RevokeMembershipSessionsUseCase } from './use-cases/revoke-membership-sessions/revoke-membership-sessions.use-case';
import {
  RegisterUserUseCase,
  type RegisterUserInput,
} from './use-cases/register-user/register-user.use-case';
import {
  StartSessionUseCase,
  type StartSessionInput,
} from './use-cases/start-session/start-session.use-case';
import {
  VerifyCredentialsUseCase,
  type VerifyCredentialsInput,
} from './use-cases/verify-credentials/verify-credentials.use-case';

export interface UserSummary {
  id: string;
  email: string;
  name: string;
}

/**
 * API do módulo identity para outros módulos (hoje: accounts, no cadastro e
 * no login). Devolve objetos simples, nunca entidades.
 */
@Injectable()
export class IdentityFacade {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly verifyCredentialsUseCase: VerifyCredentialsUseCase,
    private readonly startSessionUseCase: StartSessionUseCase,
    private readonly revokeMembershipSessionsUseCase: RevokeMembershipSessionsUseCase,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async findUser(id: string): Promise<UserSummary | null> {
    const user = await this.users.findById(id);
    return user ? toSummary(user) : null;
  }

  /** `null` também para e-mail malformado. */
  async findUserByEmail(email: string): Promise<UserSummary | null> {
    let parsed: Email;
    try {
      parsed = Email.create(email);
    } catch {
      return null;
    }
    const user = await this.users.findByEmail(parsed);
    return user ? toSummary(user) : null;
  }

  async findUsers(ids: string[]): Promise<UserSummary[]> {
    const users = await Promise.all(ids.map((id) => this.users.findById(id)));
    return users.flatMap((user) => (user ? [toSummary(user)] : []));
  }

  /** Derruba as sessões de um vínculo desativado (refresh e access tokens). */
  revokeMembershipSessions(membershipId: string): Promise<number> {
    return this.revokeMembershipSessionsUseCase.execute(membershipId);
  }

  async registerUser(input: RegisterUserInput): Promise<UserSummary> {
    return toSummary(await this.registerUserUseCase.execute(input));
  }

  /** Lança `InvalidCredentialsError` (401) se e-mail/senha não conferirem. */
  async verifyCredentials(input: VerifyCredentialsInput): Promise<UserSummary> {
    return toSummary(await this.verifyCredentialsUseCase.execute(input));
  }

  startSession(input: StartSessionInput): Promise<AuthTokens> {
    return this.startSessionUseCase.execute(input);
  }
}

function toSummary(user: { id: string; email: { value: string }; name: string }): UserSummary {
  return { id: user.id, email: user.email.value, name: user.name };
}
