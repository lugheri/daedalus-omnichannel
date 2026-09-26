import { Injectable } from '@nestjs/common';
import type { AuthTokens } from './auth-tokens';
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
  ) {}

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
