import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { Session } from '../../../domain/session.entity';
import type { AuthTokens } from '../../auth-tokens';
import { AuthTokensFactory } from '../../auth-tokens.factory';
import { IDENTITY_SETTINGS, type IdentitySettings } from '../../ports/identity-settings';
import {
  REFRESH_SECRET_GENERATOR,
  type RefreshSecretGenerator,
} from '../../ports/refresh-secret-generator';
import { SESSION_REPOSITORY, type SessionRepository } from '../../ports/session.repository';

export interface StartSessionInput {
  userId: string;
  tenantId: string;
  membershipId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Abre uma sessão para um usuário JÁ autenticado num tenant JÁ autorizado.
 * Quem verifica credenciais e vínculo com o tenant é o chamador (accounts).
 */
@Injectable()
export class StartSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REFRESH_SECRET_GENERATOR) private readonly secrets: RefreshSecretGenerator,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
    private readonly tokens: AuthTokensFactory,
  ) {}

  async execute(input: StartSessionInput): Promise<AuthTokens> {
    const secret = this.secrets.generate();
    const session = Session.start(this.ids.generate(), {
      ...input,
      refreshTokenHash: this.secrets.hash(secret),
      expiresAt: new Date(Date.now() + this.settings.refreshTokenTtlDays * DAY_MS),
    });

    await this.sessions.save(session);
    return this.tokens.create(session, secret);
  }
}
