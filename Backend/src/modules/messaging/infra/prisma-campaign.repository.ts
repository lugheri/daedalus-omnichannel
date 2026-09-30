import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { CampaignModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { CampaignRepository } from '../application/ports/campaign.repository';
import { Campaign, type CampaignAudience, type CampaignStatus } from '../domain/campaign.entity';
import type { MessagingChannel } from '../domain/messaging-provider.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaCampaignRepository implements CampaignRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(campaign: Campaign): Promise<void> {
    const data = {
      name: campaign.name,
      subject: campaign.subject,
      body: campaign.body,
      audience: campaign.audience as Prisma.InputJsonValue,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      startedAt: campaign.startedAt,
      finishedAt: campaign.finishedAt,
      audienceCursor: campaign.audienceCursor,
      queuedCount: campaign.queuedCount,
      skippedNoAddress: campaign.skippedNoAddress,
      skippedOptedOut: campaign.skippedOptedOut,
      updatedAt: campaign.updatedAt,
    };
    await this.db.campaign.upsert({
      where: { id: campaign.id, tenantId: this.tenant.tenantId },
      create: {
        id: campaign.id,
        tenantId: this.tenant.tenantId,
        channel: campaign.channel,
        createdByMembershipId: campaign.createdByMembershipId,
        createdAt: campaign.createdAt,
        ...data,
      },
      update: data,
    });
  }

  async findById(id: string): Promise<Campaign | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.campaign.findFirst({ where: { id, tenantId: this.tenant.tenantId } });
    return row ? toDomain(row) : null;
  }

  async list({ cursor, limit }: { cursor?: string; limit: number }) {
    const rows = await this.db.campaign.findMany({
      where: {
        tenantId: this.tenant.tenantId,
        ...(cursor && UUID.test(cursor) && { id: { lt: cursor } }),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    const items = rows.slice(0, limit).map(toDomain);
    return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
  }

  async delete(campaign: Campaign): Promise<void> {
    await this.db.campaign.deleteMany({
      where: { id: campaign.id, tenantId: this.tenant.tenantId },
    });
  }

  /** Sem filtro de tenant, de propósito: a varredura distribui por conta. */
  listDueAllTenants(now: Date): Promise<{ id: string; tenantId: string }[]> {
    return this.db.campaign.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: now } },
      select: { id: true, tenantId: true },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    });
  }
}

function toDomain(row: CampaignModel): Campaign {
  return Campaign.restore(row.id, {
    tenantId: row.tenantId,
    name: row.name,
    channel: row.channel as MessagingChannel,
    subject: row.subject,
    body: row.body,
    audience: row.audience as CampaignAudience,
    status: row.status as CampaignStatus,
    scheduledAt: row.scheduledAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    audienceCursor: row.audienceCursor,
    queuedCount: row.queuedCount,
    skippedNoAddress: row.skippedNoAddress,
    skippedOptedOut: row.skippedOptedOut,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
