import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { Email } from '../../../domain/email.vo';
import { EmailAlreadyInUseError } from '../../../domain/errors/email-already-in-use.error';
import { Password } from '../../../domain/password.vo';
import { User } from '../../../domain/user.entity';
import { PASSWORD_HASHER, type PasswordHasher } from '../../ports/password-hasher';
import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';

export interface RegisterUserInput {
  email: string;
  name: string;
  password: string;
}

/**
 * Cria a pessoa com login. Não é exposto por HTTP: quem cadastra é o fluxo
 * de criação de conta (accounts) ou, futuramente, o aceite de convite.
 */
@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    const email = Email.create(input.email);
    const password = Password.create(input.password);

    if (await this.users.findByEmail(email)) throw new EmailAlreadyInUseError();

    const user = User.register(this.ids.generate(), {
      email,
      name: input.name,
      passwordHash: await this.hasher.hash(password.value),
    });

    await this.users.save(user);
    await this.events.publish(user.pullEvents());
    return user;
  }
}
