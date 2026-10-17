import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { DealModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { DealKey, DealRepository } from '../application/ports/deal.repository';
import { Deal, type DealStatus } from '../domain/deal.entity';
import { isUuid } from './uuid';

const ORDER = [{ position: 'asc' }, { id: 'asc' }] satisfies Prisma.DealOrderByWithRelationInput[];

@Injectable()
export class PrismaDealRepository implements DealRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  private get tenantId() {
    return this.tenant.tenantId;
  }

  /** Só os em aberto ficam na etapa (fechados saem do funil). */
  private openIn(columnId: string): Prisma.DealWhereInput {
    return { columnId, tenantId: this.tenantId, status: 'open' };
  }

  async save(deal: Deal): Promise<void> {
    const data: DealModel = {
      id: deal.id,
      tenantId: this.tenantId,
      boardId: deal.boardId,
      columnId: deal.columnId,
      contactId: deal.contactId,
      conversationId: deal.conversationId,
      title: deal.title,
      valueCents: deal.valueCents,
      ownerId: deal.ownerId,
      status: deal.status,
      lostReason: deal.lostReason,
      closedAt: deal.closedAt,
      position: deal.position,
      enteredColumnAt: deal.enteredColumnAt,
      createdAt: deal.createdAt,
    };
    await this.db.deal.upsert({
      where: { id: deal.id, tenantId: this.tenantId },
      create: data,
      // Funil, contato e criação não mudam depois de aberto.
      update: {
        columnId: data.columnId,
        conversationId: data.conversationId,
        title: data.title,
        valueCents: data.valueCents,
        ownerId: data.ownerId,
        status: data.status,
        lostReason: data.lostReason,
        closedAt: data.closedAt,
        position: data.position,
        enteredColumnAt: data.enteredColumnAt,
      },
    });
  }

  async delete(deal: Deal): Promise<void> {
    await this.db.deal.deleteMany({ where: { id: deal.id, tenantId: this.tenantId } });
  }

  async findById(id: string): Promise<Deal | null> {
    if (!isUuid(id)) return null;
    const row = await this.db.deal.findFirst({ where: { id, tenantId: this.tenantId } });
    return row ? toDomain(row) : null;
  }

  async findOpenOnBoard(boardId: string, contactId: string): Promise<Deal | null> {
    if (!isUuid(contactId)) return null;
    const row = await this.db.deal.findFirst({
      where: { boardId, contactId, tenantId: this.tenantId, status: 'open' },
      orderBy: { createdAt: 'asc' },
    });
    return row ? toDomain(row) : null;
  }

  async listOpenByConversation(conversationId: string): Promise<Deal[]> {
    if (!isUuid(conversationId)) return [];
    const rows = await this.db.deal.findMany({
      where: { conversationId, tenantId: this.tenantId, status: 'open' },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }

  async listByContact(contactId: string): Promise<Deal[]> {
    if (!isUuid(contactId)) return [];
    const rows = await this.db.deal.findMany({
      where: { contactId, tenantId: this.tenantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return rows.map(toDomain);
  }

  async listColumn(
    columnId: string,
    { after, limit }: { after?: DealKey; limit: number },
  ): Promise<Deal[]> {
    const rows = await this.db.deal.findMany({
      where: { ...this.openIn(columnId), ...(after && afterKey(after)) },
      orderBy: ORDER,
      take: limit,
    });
    return rows.map(toDomain);
  }

  async first(columnId: string, excludeId?: string): Promise<Deal | null> {
    const row = await this.db.deal.findFirst({
      where: { ...this.openIn(columnId), ...(excludeId && { id: { not: excludeId } }) },
      orderBy: ORDER,
    });
    return row ? toDomain(row) : null;
  }

  async last(columnId: string): Promise<Deal | null> {
    const row = await this.db.deal.findFirst({
      where: { columnId, tenantId: this.tenantId },
      orderBy: [{ position: 'desc' }, { id: 'desc' }],
    });
    return row ? toDomain(row) : null;
  }

  async next(columnId: string, key: DealKey, excludeId?: string): Promise<Deal | null> {
    const row = await this.db.deal.findFirst({
      where: {
        ...this.openIn(columnId),
        ...afterKey(key),
        ...(excludeId && { NOT: { id: excludeId } }),
      },
      orderBy: ORDER,
    });
    return row ? toDomain(row) : null;
  }

  countInColumn(columnId: string): Promise<number> {
    return this.db.deal.count({ where: { columnId, tenantId: this.tenantId } });
  }

  async renumber(columnId: string): Promise<void> {
    await this.db.$executeRaw`
      UPDATE kanban.deals AS d
      SET position = s.rn - 1
      FROM (
        SELECT id, row_number() OVER (ORDER BY position, id) AS rn
        FROM kanban.deals
        WHERE tenant_id = ${this.tenantId}::uuid AND column_id = ${columnId}::uuid
      ) AS s
      WHERE d.id = s.id`;
  }

  async moveAll(fromColumnId: string, toColumnId: string): Promise<void> {
    const last = await this.last(toColumnId);
    const start = (last?.position ?? -1) + 1;
    await this.db.$executeRaw`
      UPDATE kanban.deals AS d
      SET column_id = ${toColumnId}::uuid, position = ${start} + s.rn - 1, entered_column_at = now()
      FROM (
        SELECT id, row_number() OVER (ORDER BY position, id) AS rn
        FROM kanban.deals
        WHERE tenant_id = ${this.tenantId}::uuid AND column_id = ${fromColumnId}::uuid
      ) AS s
      WHERE d.id = s.id`;
  }
}

/** "Depois deste negócio" na ordem (position, id) crescente. */
function afterKey(key: DealKey): Prisma.DealWhereInput {
  return {
    OR: [{ position: { gt: key.position } }, { position: key.position, id: { gt: key.id } }],
  };
}

export function toDomain(row: DealModel): Deal {
  return Deal.restore(row.id, {
    tenantId: row.tenantId,
    boardId: row.boardId,
    columnId: row.columnId,
    contactId: row.contactId,
    conversationId: row.conversationId,
    title: row.title,
    valueCents: row.valueCents,
    ownerId: row.ownerId,
    status: row.status as DealStatus,
    lostReason: row.lostReason,
    closedAt: row.closedAt,
    position: row.position,
    enteredColumnAt: row.enteredColumnAt,
    createdAt: row.createdAt,
  });
}
