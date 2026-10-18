import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { PlanModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { PlanRepository } from '../application/ports/plan.repository';
import { completeFeatures, completeLimits, Plan } from '../domain/plan.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Catálogo sem tenant (ver o port). */
@Injectable()
export class PrismaPlanRepository implements PlanRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(plan: Plan): Promise<void> {
    const data = {
      name: plan.name,
      description: plan.description,
      limits: plan.limits as Prisma.InputJsonValue,
      features: plan.features as Prisma.InputJsonValue,
      resellable: plan.resellable,
      isDefault: plan.isDefault,
      archived: plan.archived,
      updatedAt: plan.updatedAt,
    };
    await this.db.plan.upsert({
      where: { id: plan.id },
      create: { id: plan.id, createdAt: plan.createdAt, ...data },
      update: data,
    });
  }

  async findById(id: string): Promise<Plan | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.plan.findUnique({ where: { id } });
    return row ? toPlan(row) : null;
  }

  async findDefault(): Promise<Plan | null> {
    const row = await this.db.plan.findFirst({ where: { isDefault: true } });
    return row ? toPlan(row) : null;
  }

  async list(): Promise<Plan[]> {
    const rows = await this.db.plan.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toPlan);
  }

  async delete(plan: Plan): Promise<void> {
    await this.db.plan.delete({ where: { id: plan.id } });
  }

  countAccountsUsing(plan: Plan): Promise<number> {
    return this.db.tenant.count({
      // A conta da plataforma não tem plano (sem limite): não conta como "no padrão".
      where: plan.isDefault
        ? { isRoot: false, OR: [{ planId: plan.id }, { planId: null }] }
        : { planId: plan.id },
    });
  }
}

function toPlan(row: PlanModel): Plan {
  return Plan.restore(row.id, {
    name: row.name,
    description: row.description,
    limits: completeLimits(row.limits as Record<string, number | null>),
    features: completeFeatures(row.features as Record<string, boolean>),
    resellable: row.resellable,
    isDefault: row.isDefault,
    archived: row.archived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
