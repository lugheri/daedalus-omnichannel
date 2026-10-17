import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type {
  ParentAccessEntry,
  ParentAccessRepository,
} from '../application/ports/parent-access.repository';

@Injectable()
export class PrismaParentAccessRepository implements ParentAccessRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  async record(entry: ParentAccessEntry): Promise<void> {
    await this.txHost.tx.parentAccess.create({ data: entry });
  }

  async listByTenant(tenantId: string, limit: number): Promise<ParentAccessEntry[]> {
    return this.txHost.tx.parentAccess.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
