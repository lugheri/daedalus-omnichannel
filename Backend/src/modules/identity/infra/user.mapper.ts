import type { UserModel } from '../../../shared/infra/prisma/generated/models';
import { Email } from '../domain/email.vo';
import { User, type PlatformRole } from '../domain/user.entity';

export const UserMapper = {
  toDomain(row: UserModel): User {
    return User.restore(row.id, {
      email: Email.create(row.email),
      name: row.name,
      passwordHash: row.passwordHash,
      platformRole: row.platformRole as PlatformRole | null,
      createdAt: row.createdAt,
    });
  },

  toPersistence(user: User): UserModel {
    return {
      id: user.id,
      email: user.email.value,
      name: user.name,
      passwordHash: user.passwordHash,
      platformRole: user.platformRole,
      createdAt: user.createdAt,
    };
  },
};
