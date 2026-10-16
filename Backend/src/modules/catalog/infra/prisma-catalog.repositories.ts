import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { OfferingRepository } from '../application/ports/offering.repository';
import type { ProfessionalRepository } from '../application/ports/professional.repository';
import {
  CatalogConflictError,
  type CatalogConflictCode,
} from '../domain/errors/catalog-conflict.error';
import { Offering } from '../domain/offering.entity';
import { Professional } from '../domain/professional.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const withOfferings = { offerings: { select: { offeringId: true } } } as const;
type ProfessionalRow = Prisma.ProfessionalGetPayload<{ include: typeof withOfferings }>;
type OfferingRow = Prisma.OfferingGetPayload<object>;

/** Violação de unique (P2002) vira o conflito do domínio. */
async function translatingConflict(code: CatalogConflictCode, work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CatalogConflictError(code);
    }
    throw error;
  }
}

@Injectable()
export class PrismaOfferingRepository implements OfferingRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(offering: Offering): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const data = {
      name: offering.name,
      description: offering.description,
      durationMinutes: offering.durationMinutes,
      priceCents: offering.priceCents,
      showOnSite: offering.showOnSite,
      active: offering.active,
    };
    await translatingConflict('SERVICE_NAME_TAKEN', () =>
      this.db.offering.upsert({
        where: { id: offering.id, tenantId },
        create: { id: offering.id, tenantId, createdAt: offering.createdAt, ...data },
        update: data,
      }),
    );
  }

  async findById(id: string): Promise<Offering | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.offering.findFirst({ where: { id, tenantId: this.tenant.tenantId } });
    return row ? offeringToDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Offering[]> {
    const rows = await this.db.offering.findMany({
      where: { id: { in: ids.filter((id) => UUID.test(id)) }, tenantId: this.tenant.tenantId },
    });
    return rows.map(offeringToDomain);
  }

  async list(): Promise<Offering[]> {
    const rows = await this.db.offering.findMany({
      where: { tenantId: this.tenant.tenantId },
      orderBy: { name: 'asc' },
    });
    return rows.map(offeringToDomain);
  }

  async delete(offering: Offering): Promise<void> {
    // Os vínculos com profissionais saem junto (ON DELETE CASCADE).
    await this.db.offering.deleteMany({
      where: { id: offering.id, tenantId: this.tenant.tenantId },
    });
  }
}

@Injectable()
export class PrismaProfessionalRepository implements ProfessionalRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(professional: Professional): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const data = {
      name: professional.name,
      title: professional.title,
      bio: professional.bio,
      membershipId: professional.membershipId,
      showOnSite: professional.showOnSite,
      active: professional.active,
    };
    await translatingConflict('PROFESSIONAL_MEMBER_TAKEN', () =>
      // Profissional e serviços juntos (entra na transação em andamento, se houver).
      this.txHost.withTransaction(async () => {
        await this.db.professional.upsert({
          where: { id: professional.id, tenantId },
          create: { id: professional.id, tenantId, createdAt: professional.createdAt, ...data },
          update: data,
        });
        await this.db.professionalOffering.deleteMany({
          where: { professionalId: professional.id, tenantId },
        });
        await this.db.professionalOffering.createMany({
          data: professional.offeringIds.map((offeringId) => ({
            professionalId: professional.id,
            offeringId,
            tenantId,
          })),
        });
      }),
    );
  }

  async findById(id: string): Promise<Professional | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.professional.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
      include: withOfferings,
    });
    return row ? professionalToDomain(row) : null;
  }

  async list(): Promise<Professional[]> {
    const rows = await this.db.professional.findMany({
      where: { tenantId: this.tenant.tenantId },
      include: withOfferings,
      orderBy: { name: 'asc' },
    });
    return rows.map(professionalToDomain);
  }

  async listByOffering(offeringId: string): Promise<Professional[]> {
    if (!UUID.test(offeringId)) return [];
    const rows = await this.db.professional.findMany({
      where: { tenantId: this.tenant.tenantId, offerings: { some: { offeringId } } },
      include: withOfferings,
    });
    return rows.map(professionalToDomain);
  }

  async delete(professional: Professional): Promise<void> {
    await this.db.professional.deleteMany({
      where: { id: professional.id, tenantId: this.tenant.tenantId },
    });
  }
}

function offeringToDomain(row: OfferingRow): Offering {
  return Offering.restore(row.id, {
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    durationMinutes: row.durationMinutes,
    priceCents: row.priceCents,
    showOnSite: row.showOnSite,
    active: row.active,
    createdAt: row.createdAt,
  });
}

function professionalToDomain(row: ProfessionalRow): Professional {
  return Professional.restore(row.id, {
    tenantId: row.tenantId,
    name: row.name,
    title: row.title,
    bio: row.bio,
    membershipId: row.membershipId,
    offeringIds: row.offerings.map((o) => o.offeringId),
    showOnSite: row.showOnSite,
    active: row.active,
    createdAt: row.createdAt,
  });
}
