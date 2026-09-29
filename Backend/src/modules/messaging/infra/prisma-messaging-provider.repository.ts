import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { MessagingProviderModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { MessagingProviderRepository } from '../application/ports/messaging-provider.repository';
import {
  MessagingProvider,
  type MessagingChannel,
  type ProviderSettings,
  type ProviderStatus,
} from '../domain/messaging-provider.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaMessagingProviderRepository implements MessagingProviderRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(provider: MessagingProvider): Promise<void> {
    const data = {
      settings: provider.settings as unknown as Prisma.InputJsonValue,
      secret: provider.secret.sealed,
      secretHint: provider.secret.hint,
      status: provider.status,
      lastCheckedAt: provider.lastCheckedAt,
      lastError: provider.lastError,
      updatedAt: provider.updatedAt,
    };
    await this.db.messagingProvider.upsert({
      where: { id: provider.id, tenantId: this.tenant.tenantId },
      create: {
        id: provider.id,
        tenantId: this.tenant.tenantId,
        channel: provider.channel,
        createdAt: provider.createdAt,
        ...data,
      },
      update: data,
    });
  }

  async findByChannel(channel: MessagingChannel): Promise<MessagingProvider | null> {
    const row = await this.db.messagingProvider.findUnique({
      where: { tenantId_channel: { tenantId: this.tenant.tenantId, channel } },
    });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<MessagingProvider[]> {
    const rows = await this.db.messagingProvider.findMany({
      where: { tenantId: this.tenant.tenantId },
      orderBy: { channel: 'asc' },
    });
    return rows.map(toDomain);
  }

  /** Sem filtro de tenant, de propósito: webhooks descobrem a conta pelo provedor. */
  async findByIdAsSystem(id: string): Promise<MessagingProvider | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.messagingProvider.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async delete(provider: MessagingProvider): Promise<void> {
    await this.db.messagingProvider.deleteMany({
      where: { id: provider.id, tenantId: this.tenant.tenantId },
    });
  }
}

function toDomain(row: MessagingProviderModel): MessagingProvider {
  return MessagingProvider.restore(row.id, {
    tenantId: row.tenantId,
    channel: row.channel as MessagingChannel,
    settings: row.settings as unknown as ProviderSettings,
    secret: { sealed: row.secret, hint: row.secretHint },
    status: row.status as ProviderStatus,
    lastCheckedAt: row.lastCheckedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
