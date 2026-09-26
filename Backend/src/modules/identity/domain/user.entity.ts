import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import type { Email } from './email.vo';
import { InvalidUserNameError } from './errors/invalid-user-name.error';
import { UserRegisteredEvent } from './events/user-registered.event';

/** Papel na administração da PLATAFORMA — sem relação com cargos de tenant (ADR 0003). */
export type PlatformRole = 'platform_admin' | 'platform_support';

export interface UserProps {
  email: Email;
  name: string;
  passwordHash: string;
  platformRole: PlatformRole | null;
  createdAt: Date;
}

export interface RegisterUserProps {
  email: Email;
  name: string;
  passwordHash: string;
}

/**
 * Pessoa com login na plataforma. É global: o vínculo com cada empresa
 * (tenant) é a Membership, no módulo accounts.
 */
export class User extends AggregateRoot<UserProps> {
  static register(id: string, input: RegisterUserProps): User {
    const name = input.name.trim();
    if (!name) throw new InvalidUserNameError();

    const user = new User(id, {
      email: input.email,
      name,
      passwordHash: input.passwordHash,
      platformRole: null,
      createdAt: new Date(),
    });
    user.addEvent(new UserRegisteredEvent(id, input.email.value));
    return user;
  }

  static restore(id: string, props: UserProps): User {
    return new User(id, props);
  }

  get email() {
    return this.props.email;
  }

  get name() {
    return this.props.name;
  }

  get passwordHash() {
    return this.props.passwordHash;
  }

  get platformRole() {
    return this.props.platformRole;
  }

  get createdAt() {
    return this.props.createdAt;
  }
}
