import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import type { UnitOfWork } from '../../application/unit-of-work';
import type { PrismaService } from './prisma.service';

/**
 * Abre uma transação Prisma e a guarda no contexto (CLS). Todo repositório
 * que usa `TransactionHost.tx` dentro de `run` participa dela.
 */
@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.txHost.withTransaction(work);
  }
}
