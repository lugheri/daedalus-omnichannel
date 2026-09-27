import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { ChannelModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { ChannelRepository } from '../application/ports/channel.repository';
import { Channel, type ChannelProvider, type ChannelStatus } from '../domain/channel.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaChannelRepository implements ChannelRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async save(channel: Channel): Promise<void> {
    const data = toPersistence(channel);
    await this.txHost.tx.channel.upsert({
      where: { id: data.id, tenantId: this.tenant.tenantId },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<Channel | null> {
    if (!UUID.test(id)) return null;
    const row = await this.txHost.tx.channel.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
    });
    return row ? toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Channel[]> {
    const rows = await this.txHost.tx.channel.findMany({
      where: { id: { in: ids.filter((id) => UUID.test(id)) }, tenantId: this.tenant.tenantId },
    });
    return rows.map(toDomain);
  }

  async list(): Promise<Channel[]> {
    const rows = await this.txHost.tx.channel.findMany({
      where: { tenantId: this.tenant.tenantId },
      orderBy: { id: 'desc' },
    });
    return rows.map(toDomain);
  }

  async delete(channel: Channel): Promise<void> {
    await this.txHost.tx.channel.deleteMany({
      where: { id: channel.id, tenantId: this.tenant.tenantId },
    });
  }
}

function toDomain(row: ChannelModel): Channel {
  return Channel.restore(row.id, {
    tenantId: row.tenantId,
    provider: row.provider as ChannelProvider,
    name: row.name,
    status: row.status as ChannelStatus,
    phoneNumber: row.phoneNumber,
    statusReason: row.statusReason,
    createdAt: row.createdAt,
    statusAt: row.statusAt,
  });
}

function toPersistence(channel: Channel): ChannelModel {
  return {
    id: channel.id,
    tenantId: channel.tenantId,
    provider: channel.provider,
    name: channel.name,
    status: channel.status,
    phoneNumber: channel.phoneNumber,
    statusReason: channel.statusReason,
    createdAt: channel.createdAt,
    statusAt: channel.statusAt,
  };
}
