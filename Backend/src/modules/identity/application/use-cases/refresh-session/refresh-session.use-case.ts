import { Inject, Injectable } from '@nestjs/common';
import { InvalidRefreshTokenError } from '../../../domain/errors/invalid-refresh-token.error';
import { RefreshToken } from '../../../domain/refresh-token.vo';
import type { AuthTokens } from '../../auth-tokens';
import { AuthTokensFactory } from '../../auth-tokens.factory';
import { IDENTITY_SETTINGS, type IdentitySettings } from '../../ports/identity-settings';
import {
  REFRESH_SECRET_GENERATOR,
  type RefreshSecretGenerator,
} from '../../ports/refresh-secret-generator';
import { SESSION_REPOSITORY, type SessionRepository } from '../../ports/session.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Troca um refresh token válido por um novo par de tokens (rotação). */
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REFRESH_SECRET_GENERATOR) private readonly secrets: RefreshSecretGenerator,
    @Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
    private readonly tokens: AuthTokensFactory,
  ) {}

  async execute(rawRefreshToken: string): Promise<AuthTokens> {
    const presented = RefreshToken.parse(rawRefreshToken);
    const session = presented && (await this.sessions.findById(presented.sessionId));
    if (!presented || !session) throw new InvalidRefreshTokenError();

    const now = new Date();
    const newSecret = this.secrets.generate();
    const result = session.rotate(
      this.secrets.hash(presented.secret),
      {
        refreshTokenHash: this.secrets.hash(newSecret),
        expiresAt: new Date(now.getTime() + this.settings.refreshTokenTtlDays * DAY_MS),
      },
      now,
    );

    // Salva também no caso de reuso: a revogação precisa ser persistida.
    await this.sessions.save(session);

    if (result !== 'rotated') throw new InvalidRefreshTokenError();
    return this.tokens.create(session, newSecret);
  }
}
