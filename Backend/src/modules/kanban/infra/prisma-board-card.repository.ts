import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { BoardCardModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { BoardCardRepository, CardKey } from '../application/ports/board-card.repository';
import { BoardCard } from '../domain/board-card.entity';
import { isUuid } from './uuid';

const ORDER = [
  { position: 'asc' },
  { id: 'asc' },
] satisfies Prisma.BoardCardOrderByWithRelationInput[];

@Injectable()
export class PrismaBoardCardRepository implements BoardCardRepository {
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

  async save(card: BoardCard): Promise<void> {
    const data: BoardCardModel = {
      id: card.id,
      tenantId: this.tenantId,
      boardId: card.boardId,
      columnId: card.columnId,
      conversationId: card.conversationId,
      position: card.position,
      enteredColumnAt: card.enteredColumnAt,
      createdAt: card.createdAt,
    };
    await this.db.boardCard.upsert({
      where: { id: card.id, tenantId: this.tenantId },
      create: data,
      update: {
        columnId: data.columnId,
        position: data.position,
        enteredColumnAt: data.enteredColumnAt,
      },
    });
  }

  async delete(card: BoardCard): Promise<void> {
    await this.db.boardCard.deleteMany({ where: { id: card.id, tenantId: this.tenantId } });
  }

  async findById(id: string): Promise<BoardCard | null> {
    if (!isUuid(id)) return null;
    const row = await this.db.boardCard.findFirst({ where: { id, tenantId: this.tenantId } });
    return row ? toDomain(row) : null;
  }

  async findOnBoard(boardId: string, conversationId: string): Promise<BoardCard | null> {
    if (!isUuid(conversationId)) return null;
    const row = await this.db.boardCard.findFirst({
      where: { boardId, conversationId, tenantId: this.tenantId },
    });
    return row ? toDomain(row) : null;
  }

  async listByConversation(conversationId: string): Promise<BoardCard[]> {
    if (!isUuid(conversationId)) return [];
    const rows = await this.db.boardCard.findMany({
      where: { conversationId, tenantId: this.tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }

  async listColumn(
    columnId: string,
    { after, limit }: { after?: CardKey; limit: number },
  ): Promise<BoardCard[]> {
    const rows = await this.db.boardCard.findMany({
      where: { columnId, tenantId: this.tenantId, ...(after && afterKey(after)) },
      orderBy: ORDER,
      take: limit,
    });
    return rows.map(toDomain);
  }

  async first(columnId: string, excludeId?: string): Promise<BoardCard | null> {
    const row = await this.db.boardCard.findFirst({
      where: { columnId, tenantId: this.tenantId, ...(excludeId && { id: { not: excludeId } }) },
      orderBy: ORDER,
    });
    return row ? toDomain(row) : null;
  }

  async last(columnId: string): Promise<BoardCard | null> {
    const row = await this.db.boardCard.findFirst({
      where: { columnId, tenantId: this.tenantId },
      orderBy: [{ position: 'desc' }, { id: 'desc' }],
    });
    return row ? toDomain(row) : null;
  }

  async next(columnId: string, key: CardKey, excludeId?: string): Promise<BoardCard | null> {
    const row = await this.db.boardCard.findFirst({
      where: {
        columnId,
        tenantId: this.tenantId,
        ...afterKey(key),
        ...(excludeId && { NOT: { id: excludeId } }),
      },
      orderBy: ORDER,
    });
    return row ? toDomain(row) : null;
  }

  countInColumn(columnId: string): Promise<number> {
    return this.db.boardCard.count({ where: { columnId, tenantId: this.tenantId } });
  }

  async renumber(columnId: string): Promise<void> {
    await this.db.$executeRaw`
      UPDATE kanban.board_cards AS c
      SET position = s.rn - 1
      FROM (
        SELECT id, row_number() OVER (ORDER BY position, id) AS rn
        FROM kanban.board_cards
        WHERE tenant_id = ${this.tenantId}::uuid AND column_id = ${columnId}::uuid
      ) AS s
      WHERE c.id = s.id`;
  }

  async moveAll(fromColumnId: string, toColumnId: string): Promise<void> {
    const last = await this.last(toColumnId);
    const start = (last?.position ?? -1) + 1;
    await this.db.$executeRaw`
      UPDATE kanban.board_cards AS c
      SET column_id = ${toColumnId}::uuid, position = ${start} + s.rn - 1, entered_column_at = now()
      FROM (
        SELECT id, row_number() OVER (ORDER BY position, id) AS rn
        FROM kanban.board_cards
        WHERE tenant_id = ${this.tenantId}::uuid AND column_id = ${fromColumnId}::uuid
      ) AS s
      WHERE c.id = s.id`;
  }
}

/** "Depois deste card" na ordem (position, id) crescente. */
function afterKey(key: CardKey): Prisma.BoardCardWhereInput {
  return {
    OR: [{ position: { gt: key.position } }, { position: key.position, id: { gt: key.id } }],
  };
}

function toDomain(row: BoardCardModel): BoardCard {
  return BoardCard.restore(row.id, {
    tenantId: row.tenantId,
    boardId: row.boardId,
    columnId: row.columnId,
    conversationId: row.conversationId,
    position: row.position,
    enteredColumnAt: row.enteredColumnAt,
    createdAt: row.createdAt,
  });
}
