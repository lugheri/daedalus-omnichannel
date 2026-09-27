import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { TeamRepository } from '../application/ports/team.repository';
import { TeamNameTakenError } from '../domain/errors/team-name-taken.error';
import { Team } from '../domain/team.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const withMembers = { members: { select: { membershipId: true } } } as const;
type TeamRow = Prisma.TeamGetPayload<{ include: typeof withMembers }>;

@Injectable()
export class PrismaTeamRepository implements TeamRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(team: Team): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const data = { id: team.id, tenantId, name: team.name, createdAt: team.createdAt };
    try {
      // Equipe e membros juntos (entra na transação em andamento, se houver).
      await this.txHost.withTransaction(async () => {
        await this.db.team.upsert({
          where: { id: team.id, tenantId },
          create: data,
          update: { name: team.name },
        });
        await this.db.teamMember.deleteMany({ where: { teamId: team.id, tenantId } });
        await this.db.teamMember.createMany({
          data: team.memberIds.map((membershipId) => ({ teamId: team.id, membershipId, tenantId })),
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new TeamNameTakenError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Team | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.team.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
      include: withMembers,
    });
    return row ? toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Team[]> {
    const rows = await this.db.team.findMany({
      where: { id: { in: ids.filter((id) => UUID.test(id)) }, tenantId: this.tenant.tenantId },
      include: withMembers,
    });
    return rows.map(toDomain);
  }

  async list(): Promise<Team[]> {
    const rows = await this.db.team.findMany({
      where: { tenantId: this.tenant.tenantId },
      include: withMembers,
      orderBy: { name: 'asc' },
    });
    return rows.map(toDomain);
  }

  async delete(team: Team): Promise<void> {
    // Os membros saem junto (ON DELETE CASCADE).
    await this.db.team.deleteMany({ where: { id: team.id, tenantId: this.tenant.tenantId } });
  }

  async teamIdsOf(membershipId: string): Promise<string[]> {
    const rows = await this.db.teamMember.findMany({
      where: { membershipId, tenantId: this.tenant.tenantId },
      select: { teamId: true },
    });
    return rows.map((row) => row.teamId);
  }
}

function toDomain(row: TeamRow): Team {
  return Team.restore(row.id, {
    tenantId: row.tenantId,
    name: row.name,
    memberIds: row.members.map((m) => m.membershipId),
    createdAt: row.createdAt,
  });
}
