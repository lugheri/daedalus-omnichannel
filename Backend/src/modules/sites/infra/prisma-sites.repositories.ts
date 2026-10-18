import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { Prisma } from '../../../shared/infra/prisma/generated/client';
import type {
  SiteAssetModel,
  SiteModel,
  SiteTemplateModel,
} from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { SiteAssetRepository } from '../application/ports/site-asset.repository';
import type { SiteTemplateRepository } from '../application/ports/site-template.repository';
import type { SiteRepository } from '../application/ports/site.repository';
import { SiteConflictError } from '../domain/errors/site-conflict.error';
import type { SiteAsset } from '../domain/site-asset';
import { completeSiteContent, type SiteContent } from '../domain/site-content';
import type { SiteDomainStatus } from '../domain/site-domain';
import { SiteTemplate, type SiteTemplateKind } from '../domain/site-template.entity';
import { Site, type SitePendingAction } from '../domain/site.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaSiteTemplateRepository implements SiteTemplateRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(template: SiteTemplate): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const data = {
      name: template.name,
      niche: template.niche,
      description: template.description,
      html: template.html,
      available: template.available,
      updatedAt: template.updatedAt,
    };
    await this.db.siteTemplate.upsert({
      where: { id: template.id, tenantId },
      create: {
        id: template.id,
        tenantId,
        kind: template.kind,
        createdAt: template.createdAt,
        ...data,
      },
      update: data,
    });
  }

  async findOwned(id: string): Promise<SiteTemplate | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.siteTemplate.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
    });
    return row ? toTemplate(row) : null;
  }

  async listOwned(): Promise<SiteTemplate[]> {
    const rows = await this.db.siteTemplate.findMany({
      where: { tenantId: this.tenant.tenantId },
      orderBy: { name: 'asc' },
    });
    return rows.map(toTemplate);
  }

  async delete(template: SiteTemplate): Promise<void> {
    await this.db.siteTemplate.deleteMany({
      where: { id: template.id, tenantId: this.tenant.tenantId },
    });
  }

  // Sem filtro de tenant DE PROPÓSITO nas três abaixo: o modelo é da conta da
  // plataforma e usado por todas (ver o port). Só leitura.

  async findForSite(id: string): Promise<SiteTemplate | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.siteTemplate.findUnique({ where: { id } });
    return row ? toTemplate(row) : null;
  }

  async listAvailable(kind: SiteTemplateKind): Promise<SiteTemplate[]> {
    const rows = await this.db.siteTemplate.findMany({
      where: { available: true, kind },
      orderBy: { name: 'asc' },
    });
    return rows.map(toTemplate);
  }

  async countSitesUsing(id: string): Promise<number> {
    const [sites, variants] = await Promise.all([
      this.db.site.count({ where: { templateId: id } }),
      this.db.landingVariant.count({ where: { templateId: id } }),
    ]);
    return sites + variants;
  }
}

function toTemplate(row: SiteTemplateModel): SiteTemplate {
  return SiteTemplate.restore(row.id, {
    tenantId: row.tenantId,
    kind: row.kind as SiteTemplateKind,
    name: row.name,
    niche: row.niche,
    description: row.description,
    html: row.html,
    available: row.available,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

@Injectable()
export class PrismaSiteRepository implements SiteRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(site: Site): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const edit = {
      templateId: site.templateId,
      slug: site.slug,
      content: site.content as unknown as Prisma.InputJsonValue,
      customDomain: site.customDomain,
      updatedAt: site.updatedAt,
    };
    try {
      await this.db.site.upsert({
        where: { id: site.id, tenantId },
        create: {
          id: site.id,
          tenantId,
          ...edit,
          publishedSlug: site.publishedSlug,
          publishedAt: site.publishedAt,
          pendingAction: site.pendingAction,
          lastError: site.lastError,
          publishedDomain: site.publishedDomain,
          domainStatus: site.domainStatus,
          domainCheckedAt: site.domainCheckedAt,
          createdAt: site.createdAt,
        },
        // Só o que a pessoa edita: o estado da publicação é do worker.
        update: edit,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = JSON.stringify(error.meta ?? {});
        throw new SiteConflictError(
          target.includes('custom_domain') || target.includes('customDomain')
            ? 'SITE_DOMAIN_TAKEN'
            : target.includes('slug')
              ? 'SITE_SLUG_TAKEN'
              : 'SITE_ALREADY_EXISTS',
        );
      }
      throw error;
    }
  }

  async savePublication(site: Site): Promise<void> {
    await this.db.site.updateMany({
      where: { id: site.id, tenantId: this.tenant.tenantId },
      data: {
        publishedSlug: site.publishedSlug,
        publishedDomain: site.publishedDomain,
        publishedAt: site.publishedAt,
        pendingAction: site.pendingAction,
        lastError: site.lastError,
      },
    });
  }

  async saveDomainStatus(site: Site): Promise<void> {
    await this.db.site.updateMany({
      where: { id: site.id, tenantId: this.tenant.tenantId, customDomain: site.customDomain },
      data: { domainStatus: site.domainStatus, domainCheckedAt: site.domainCheckedAt },
    });
  }

  async findCurrent(): Promise<Site | null> {
    const row = await this.db.site.findUnique({ where: { tenantId: this.tenant.tenantId } });
    return row ? toSite(row) : null;
  }

  async findById(id: string): Promise<Site | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.site.findFirst({ where: { id, tenantId: this.tenant.tenantId } });
    return row ? toSite(row) : null;
  }

  async isSlugTaken(slug: string, exceptSiteId: string | null): Promise<boolean> {
    // Sem filtro de tenant DE PROPÓSITO: o endereço é único entre as contas.
    const row = await this.db.site.findFirst({
      where: {
        OR: [{ slug }, { publishedSlug: slug }],
        ...(exceptSiteId ? { NOT: { id: exceptSiteId } } : {}),
      },
      select: { id: true },
    });
    return row !== null;
  }

  async isDomainTaken(domains: string[], exceptSiteId: string): Promise<boolean> {
    // Sem filtro de tenant DE PROPÓSITO: o domínio é único entre as contas.
    const row = await this.db.site.findFirst({
      where: {
        OR: [{ customDomain: { in: domains } }, { publishedDomain: { in: domains } }],
        NOT: { id: exceptSiteId },
      },
      select: { id: true },
    });
    return row !== null;
  }
}

function toSite(row: SiteModel): Site {
  return Site.restore(row.id, {
    tenantId: row.tenantId,
    templateId: row.templateId,
    slug: row.slug,
    content: completeSiteContent(row.content as unknown as Partial<SiteContent>),
    publishedSlug: row.publishedSlug,
    publishedAt: row.publishedAt,
    pendingAction: row.pendingAction as SitePendingAction | null,
    lastError: row.lastError,
    customDomain: row.customDomain,
    publishedDomain: row.publishedDomain,
    domainStatus: row.domainStatus as SiteDomainStatus | null,
    domainCheckedAt: row.domainCheckedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

@Injectable()
export class PrismaSiteAssetRepository implements SiteAssetRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(asset: SiteAsset): Promise<void> {
    await this.db.siteAsset.create({ data: { ...asset, tenantId: this.tenant.tenantId } });
  }

  async findById(id: string): Promise<SiteAsset | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.siteAsset.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
    });
    return row ? toAsset(row) : null;
  }

  async findByIds(ids: string[]): Promise<SiteAsset[]> {
    const valid = ids.filter((id) => UUID.test(id));
    if (valid.length === 0) return [];
    const rows = await this.db.siteAsset.findMany({
      where: { id: { in: valid }, tenantId: this.tenant.tenantId },
    });
    return rows.map(toAsset);
  }

  async list(): Promise<SiteAsset[]> {
    const rows = await this.db.siteAsset.findMany({
      where: { tenantId: this.tenant.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map(toAsset);
  }

  async delete(asset: SiteAsset): Promise<void> {
    await this.db.siteAsset.deleteMany({
      where: { id: asset.id, tenantId: this.tenant.tenantId },
    });
  }
}

function toAsset(row: SiteAssetModel): SiteAsset {
  return {
    id: row.id,
    tenantId: row.tenantId,
    fileName: row.fileName,
    contentType: row.contentType,
    size: row.size,
    createdAt: row.createdAt,
  };
}
