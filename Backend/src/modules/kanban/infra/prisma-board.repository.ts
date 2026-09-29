import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { BoardRepository } from '../application/ports/board.repository';
import { Board, type AutoAdd } from '../domain/board.entity';
import { BoardNameTakenError } from '../domain/errors/board-name-taken.error';
import { isUuid } from './uuid';

const withColumns = { columns: { orderBy: { position: 'asc' } } } as const;
type BoardRow = Prisma.BoardGetPayload<{ include: typeof withColumns }>;

@Injectable()
export class PrismaBoardRepository implements BoardRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(board: Board): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const data = {
      name: board.name,
      autoAddMode: board.autoAdd.mode,
      autoAddTeamId: board.autoAdd.mode === 'team' ? board.autoAdd.teamId : null,
    };
    try {
      await this.txHost.withTransaction(async () => {
        await this.db.board.upsert({
          where: { id: board.id, tenantId },
          create: { id: board.id, tenantId, createdAt: board.createdAt, ...data },
          update: data,
        });
        const ids = board.columns.map((c) => c.id);
        await this.db.boardColumn.deleteMany({
          where: { boardId: board.id, tenantId, id: { notIn: ids } },
        });
        for (const [position, column] of board.columns.entries()) {
          await this.db.boardColumn.upsert({
            where: { id: column.id, tenantId },
            create: { id: column.id, tenantId, boardId: board.id, name: column.name, position },
            update: { name: column.name, position },
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BoardNameTakenError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Board | null> {
    if (!isUuid(id)) return null;
    const row = await this.db.board.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
      include: withColumns,
    });
    return row ? toDomain(row) : null;
  }

  async findByName(name: string): Promise<Board | null> {
    const row = await this.db.board.findFirst({
      where: { tenantId: this.tenant.tenantId, name: { equals: name, mode: 'insensitive' } },
      include: withColumns,
    });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<Board[]> {
    const rows = await this.db.board.findMany({
      where: { tenantId: this.tenant.tenantId },
      include: withColumns,
      orderBy: { name: 'asc' },
    });
    return rows.map(toDomain);
  }

  async delete(board: Board): Promise<void> {
    // Colunas e cards saem junto (ON DELETE CASCADE).
    await this.db.board.deleteMany({ where: { id: board.id, tenantId: this.tenant.tenantId } });
  }

  async listAcceptingNewConversations(teamId: string | null): Promise<Board[]> {
    const rows = await this.db.board.findMany({
      where: {
        tenantId: this.tenant.tenantId,
        OR: [
          { autoAddMode: 'all' },
          ...(teamId ? [{ autoAddMode: 'team', autoAddTeamId: teamId }] : []),
        ],
      },
      include: withColumns,
    });
    return rows.map(toDomain);
  }

  async clearAutoAddTeam(teamId: string): Promise<void> {
    await this.db.board.updateMany({
      where: { tenantId: this.tenant.tenantId, autoAddMode: 'team', autoAddTeamId: teamId },
      data: { autoAddMode: 'none', autoAddTeamId: null },
    });
  }
}

function toDomain(row: BoardRow): Board {
  const autoAdd: AutoAdd =
    row.autoAddMode === 'team' && row.autoAddTeamId
      ? { mode: 'team', teamId: row.autoAddTeamId }
      : row.autoAddMode === 'all'
        ? { mode: 'all' }
        : { mode: 'none' };
  return Board.restore(row.id, {
    tenantId: row.tenantId,
    name: row.name,
    columns: row.columns.map((c) => ({ id: c.id, name: c.name })),
    autoAdd,
    createdAt: row.createdAt,
  });
}
