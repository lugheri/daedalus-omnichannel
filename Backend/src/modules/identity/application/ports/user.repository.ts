import type { Email } from '../../domain/email.vo';
import type { User } from '../../domain/user.entity';

/** Usuários são globais (não pertencem a um tenant): sem filtro de tenant aqui. */
export interface UserRepository {
  /** Lança `EmailAlreadyInUseError` se o e-mail já existir. */
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
