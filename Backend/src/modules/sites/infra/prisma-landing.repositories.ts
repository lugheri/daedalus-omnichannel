import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { Prisma } from '../../../shared/infra/prisma/generated/client';
import type {
  LandingPageModel,
  LandingVariantModel,
} from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { LandingPageRepository } from '../application/ports/landing-page.repository';
import type { LandingStatsRepository } from '../application/ports/landing-stats.repository';
import type { VariantNumbers } from '../domain/ab-test';
import { SiteConflictError } from '../domain/errors/site-conflict.error';
import { completeLandingContent, type LandingContent } from '../domain/landing-content';
import { LandingPage, type LandingVariant, type VariantCode } from '../domain/landing-page.entity';
import type { SitePendingAction } from '../domain/site.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaLandingPageRepository implements LandingPageRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(page: LandingPage): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const edit = {
      name: page.name,
      path: page.path,
      formId: page.formId,
      updatedAt: page.updatedAt,
    };
    const variantData = (v: LandingVariant) => ({
      code: v.code,
      name: v.name,
      templateId: v.templateId,
      content: v.content as unknown as Prisma.InputJsonValue,
      weight: v.weight,
      updatedAt: v.updatedAt,
    });
    const create = (v: LandingVariant) => ({
      id: v.id,
      tenantId,
      createdAt: v.createdAt,
      ...variantData(v),
    });
    try {
      // Escrita aninhada: página e variantes numa transação só.
      await this.db.landingPage.upsert({
        where: { id: page.id, tenantId },
        create: {
          id: page.id,
          tenantId,
          ...edit,
          pendingAction: page.pendingAction,
          lastError: page.lastError,
          publishedAt: page.publishedAt,
          publishedFolders: page.publishedFolders,
          publishedPath: page.publishedPath,
          publishedCodes: page.publishedCodes,
          createdAt: page.createdAt,
          variants: { create: page.variants.map(create) },
        },
        update: {
          ...edit,
          variants: {
            deleteMany: { id: { notIn: page.variants.map((v) => v.id) } },
            upsert: page.variants.map((v) => ({
              where: { id: v.id },
              create: create(v),
              update: variantData(v),
            })),
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new SiteConflictError('LANDING_PATH_TAKEN');
      }
      throw error;
    }
  }

  async savePublication(page: LandingPage): Promise<void> {
    await this.db.landingPage.updateMany({
      where: { id: page.id, tenantId: this.tenant.tenantId },
      data: {
        pendingAction: page.pendingAction,
        lastError: page.lastError,
        publishedAt: page.publishedAt,
        publishedFolders: page.publishedFolders,
        publishedPath: page.publishedPath,
        publishedCodes: page.publishedCodes,
      },
    });
  }

  async findById(id: string): Promise<LandingPage | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.landingPage.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
      include: { variants: true },
    });
    return row ? toPage(row) : null;
  }

  async list(): Promise<LandingPage[]> {
    const rows = await this.db.landingPage.findMany({
      where: { tenantId: this.tenant.tenantId },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPage);
  }

  count(): Promise<number> {
    return this.db.landingPage.count({ where: { tenantId: this.tenant.tenantId } });
  }

  async isPathTaken(path: string, exceptPageId: string | null): Promise<boolean> {
    const row = await this.db.landingPage.findFirst({
      where: {
        tenantId: this.tenant.tenantId,
        OR: [{ path }, { publishedPath: path }],
        ...(exceptPageId ? { NOT: { id: exceptPageId } } : {}),
      },
      select: { id: true },
    });
    return row !== null;
  }

  async listLive(): Promise<LandingPage[]> {
    const rows = await this.db.landingPage.findMany({
      where: { tenantId: this.tenant.tenantId, publishedPath: { not: null } },
      include: { variants: true },
    });
    return rows.map(toPage);
  }

  async delete(page: LandingPage): Promise<void> {
    await this.db.landingPage.deleteMany({
      where: { id: page.id, tenantId: this.tenant.tenantId },
    });
  }

  async isAssetUsed(assetId: string): Promise<boolean> {
    const row = await this.db.landingVariant.findFirst({
      where: {
        tenantId: this.tenant.tenantId,
        content: { path: ['heroImageAssetId'], equals: assetId },
      },
      select: { id: true },
    });
    return row !== null;
  }

  async findVariantOwnerAsSystem(variantId: string) {
    if (!UUID.test(variantId)) return null;
    // Sem filtro de tenant DE PROPÓSITO: é a variante que diz a conta (rota pública).
    const row = await this.db.landingVariant.findUnique({
      where: { id: variantId },
      select: { tenantId: true, landingPageId: true, page: { select: { publishedPath: true } } },
    });
    return row
      ? {
          tenantId: row.tenantId,
          landingPageId: row.landingPageId,
          live: row.page.publishedPath !== null,
        }
      : null;
  }
}

function toPage(row: LandingPageModel & { variants: LandingVariantModel[] }): LandingPage {
  return LandingPage.restore(row.id, {
    tenantId: row.tenantId,
    name: row.name,
    path: row.path,
    formId: row.formId,
    variants: row.variants
      .map((v): LandingVariant => ({
        id: v.id,
        code: v.code as VariantCode,
        name: v.name,
        templateId: v.templateId,
        content: completeLandingContent(v.content as unknown as Partial<LandingContent>),
        weight: v.weight,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    pendingAction: row.pendingAction as SitePendingAction | null,
    lastError: row.lastError,
    publishedAt: row.publishedAt,
    publishedFolders: row.publishedFolders,
    publishedPath: row.publishedPath,
    publishedCodes: row.publishedCodes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

@Injectable()
export class PrismaLandingStatsRepository implements LandingStatsRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async recordView(variantId: string, day: string): Promise<void> {
    // Soma atômica (duas visitas ao mesmo tempo não se perdem).
    await this.db.$executeRaw`
      INSERT INTO sites.landing_views (variant_id, day, tenant_id, views)
      VALUES (${variantId}::uuid, ${day}::date, ${this.tenant.tenantId}::uuid, 1)
      ON CONFLICT (variant_id, day) DO UPDATE SET views = sites.landing_views.views + 1`;
  }

  async recordConversion(conversion: {
    id: string;
    landingPageId: string;
    variantId: string;
    at: Date;
  }): Promise<void> {
    await this.db.landingConversion.createMany({
      data: [
        {
          id: conversion.id,
          tenantId: this.tenant.tenantId,
          landingPageId: conversion.landingPageId,
          variantId: conversion.variantId,
          createdAt: conversion.at,
        },
      ],
      skipDuplicates: true,
    });
  }

  async totals(variantIds: string[]): Promise<Map<string, VariantNumbers>> {
    const result = new Map<string, VariantNumbers>();
    if (variantIds.length === 0) return result;
    const where = { tenantId: this.tenant.tenantId, variantId: { in: variantIds } };
    const [views, conversions] = await Promise.all([
      this.db.landingView.groupBy({ by: ['variantId'], where, _sum: { views: true } }),
      this.db.landingConversion.groupBy({ by: ['variantId'], where, _count: { _all: true } }),
    ]);
    const entry = (id: string) => {
      let numbers = result.get(id);
      if (!numbers) result.set(id, (numbers = { views: 0, conversions: 0 }));
      return numbers;
    };
    for (const row of views) entry(row.variantId).views = row._sum.views ?? 0;
    for (const row of conversions) entry(row.variantId).conversions = row._count._all;
    return result;
  }

  async clear(variantIds: string[]): Promise<void> {
    if (variantIds.length === 0) return;
    const where = { tenantId: this.tenant.tenantId, variantId: { in: variantIds } };
    await this.db.landingView.deleteMany({ where });
    await this.db.landingConversion.deleteMany({ where });
  }
}
