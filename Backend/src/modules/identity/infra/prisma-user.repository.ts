import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { UserRepository } from '../application/ports/user.repository';
import type { Email } from '../domain/email.vo';
import { EmailAlreadyInUseError } from '../domain/errors/email-already-in-use.error';
import type { User } from '../domain/user.entity';
import { UserMapper } from './user.mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(user: User): Promise<void> {
    const data = UserMapper.toPersistence(user);
    try {
      await this.db.user.upsert({ where: { id: data.id }, create: data, update: data });
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_key')) throw new EmailAlreadyInUseError();
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { email: email.value } });
    return row ? UserMapper.toDomain(row) : null;
  }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes(constraint)
  );
}
