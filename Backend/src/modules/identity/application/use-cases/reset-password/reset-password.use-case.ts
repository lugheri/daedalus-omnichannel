import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { Email } from '../../../domain/email.vo';
import { UserNotFoundError } from '../../../domain/errors/user-not-found.error';
import { Password } from '../../../domain/password.vo';
import { IDENTITY_SETTINGS, type IdentitySettings } from '../../ports/identity-settings';
import { PASSWORD_HASHER, type PasswordHasher } from '../../ports/password-hasher';
import { REVOKED_SESSION_LIST, type RevokedSessionList } from '../../ports/revoked-session-list';
import { SESSION_REPOSITORY, type SessionRepository } from '../../ports/session.repository';
import {
  TEMPORARY_PASSWORD_GENERATOR,
  type TemporaryPasswordGenerator,
} from '../../ports/temporary-password-generator';
import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';

export interface ResetPasswordResult {
  userId: string;
  email: string;
  /** Em texto puro: quem chamou mostra UMA vez e descarta. Nunca logar. */
  temporaryPassword: string;
  revokedSessions: number;
}

/**
 * Redefinição MANUAL de senha, para a operação (comando
 * `node dist/reset-password.js <email>`), enquanto não há recuperação por
 * e-mail nem troca da própria senha: gera uma senha temporária forte, grava o
 * hash (mesmo `PasswordHasher` do cadastro) e derruba TODAS as sessões da
 * pessoa, em todas as contas — se a senha vazou, quem a usou perde o acesso
 * junto com o dono.
 *
 * Não é exposto por HTTP: sem confirmar a identidade por outro canal, uma rota
 * dessas entregaria a conta de qualquer um.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TEMPORARY_PASSWORD_GENERATOR) private readonly generator: TemporaryPasswordGenerator,
    @Inject(REVOKED_SESSION_LIST) private readonly revoked: RevokedSessionList,
    @Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(rawEmail: string): Promise<ResetPasswordResult> {
    const email = Email.create(rawEmail);
    // Passa pelas mesmas regras de qualquer senha (se o gerador mudar e sair
    // do formato, falha aqui, antes de gravar).
    const password = Password.create(this.generator.generate());

    const { userId, revokedIds } = await this.unitOfWork.run(async () => {
      const user = await this.users.findByEmail(email);
      if (!user) throw new UserNotFoundError();

      user.changePassword(await this.hasher.hash(password.value));
      await this.users.save(user);

      const now = new Date();
      const open = await this.sessions.findUnrevokedByUserId(user.id);
      for (const session of open) {
        session.revoke(now);
        await this.sessions.save(session);
      }
      return { userId: user.id, revokedIds: open.map((session) => session.id) };
    });

    // Depois do commit: a lista no Redis só recusa os access tokens em
    // circulação de sessões que de fato foram revogadas no banco.
    for (const id of revokedIds) {
      await this.revoked.add(id, this.settings.accessTokenTtlSeconds);
    }

    return {
      userId,
      email: email.value,
      temporaryPassword: password.value,
      revokedSessions: revokedIds.length,
    };
  }
}
