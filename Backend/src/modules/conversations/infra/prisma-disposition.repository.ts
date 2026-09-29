import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type {
  ConversationDispositionModel,
  DispositionModel,
} from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { ConversationDispositionRepository } from '../application/ports/conversation-disposition.repository';
import type { DispositionRepository } from '../application/ports/disposition.repository';
import { ConversationDisposition } from '../domain/conversation-disposition.entity';
import { Disposition, type DispositionColor } from '../domain/disposition.entity';
import { isUuid } from './uuid';

@Injectable()
export class PrismaDispositionRepository implements DispositionRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(disposition: Disposition): Promise<void> {
    const data: DispositionModel = {
      id: disposition.id,
      tenantId: this.tenant.tenantId,
      name: disposition.name,
      color: disposition.color,
      archivedAt: disposition.archivedAt,
      createdAt: disposition.createdAt,
    };
    await this.db.disposition.upsert({
      where: { id: data.id, tenantId: data.tenantId },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<Disposition | null> {
    if (!isUuid(id)) return null;
    const row = await this.db.disposition.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
    });
    return row ? toDomain(row) : null;
  }

  async findByName(name: string): Promise<Disposition | null> {
    const row = await this.db.disposition.findFirst({
      where: { tenantId: this.tenant.tenantId, name: { equals: name, mode: 'insensitive' } },
    });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<Disposition[]> {
    const rows = await this.db.disposition.findMany({
      where: { tenantId: this.tenant.tenantId },
      orderBy: { name: 'asc' },
    });
    return rows.map(toDomain);
  }

  async hasActive(): Promise<boolean> {
    const row = await this.db.disposition.findFirst({
      where: { tenantId: this.tenant.tenantId, archivedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  async isUsed(id: string): Promise<boolean> {
    const row = await this.db.conversationDisposition.findFirst({
      where: { tenantId: this.tenant.tenantId, dispositionId: id },
      select: { id: true },
    });
    return row !== null;
  }

  async delete(id: string): Promise<void> {
    await this.db.disposition.deleteMany({ where: { id, tenantId: this.tenant.tenantId } });
  }
}

@Injectable()
export class PrismaConversationDispositionRepository implements ConversationDispositionRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(record: ConversationDisposition): Promise<void> {
    const data: ConversationDispositionModel = {
      id: record.id,
      tenantId: this.tenant.tenantId,
      conversationId: record.conversationId,
      dispositionId: record.dispositionId,
      note: record.note,
      membershipId: record.membershipId,
      createdAt: record.createdAt,
    };
    await this.db.conversationDisposition.create({ data });
  }

  async listByConversation(conversationId: string): Promise<ConversationDisposition[]> {
    const rows = await this.db.conversationDisposition.findMany({
      where: { tenantId: this.tenant.tenantId, conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) =>
      ConversationDisposition.restore(row.id, {
        tenantId: row.tenantId,
        conversationId: row.conversationId,
        dispositionId: row.dispositionId,
        note: row.note,
        membershipId: row.membershipId,
        createdAt: row.createdAt,
      }),
    );
  }
}

function toDomain(row: DispositionModel): Disposition {
  return Disposition.restore(row.id, {
    tenantId: row.tenantId,
    name: row.name,
    color: row.color as DispositionColor,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
  });
}
