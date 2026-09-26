import { Inject, Injectable } from '@nestjs/common';
import { Email } from '../../../domain/email.vo';
import { InvalidCredentialsError } from '../../../domain/errors/invalid-credentials.error';
import type { User } from '../../../domain/user.entity';
import { PASSWORD_HASHER, type PasswordHasher } from '../../ports/password-hasher';
import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';

export interface VerifyCredentialsInput {
  email: string;
  password: string;
}

@Injectable()
export class VerifyCredentialsUseCase {
  /** Hash de uma senha qualquer, calculado uma vez (ver `execute`). */
  private dummyHash: Promise<string> | null = null;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: VerifyCredentialsInput): Promise<User> {
    const user = await this.findUser(input.email);

    // Mesmo sem usuário, uma verificação de hash é feita: sem isso, a resposta
    // para e-mails inexistentes seria bem mais rápida, e medir o tempo
    // revelaria quais e-mails estão cadastrados.
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await this.hasher.verify(hash, input.password);

    if (!user || !valid) throw new InvalidCredentialsError();
    return user;
  }

  private async findUser(rawEmail: string): Promise<User | null> {
    try {
      return await this.users.findByEmail(Email.create(rawEmail));
    } catch {
      return null; // e-mail malformado: tratado como credencial inválida
    }
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('dummy-password-for-timing');
    return this.dummyHash;
  }
}
