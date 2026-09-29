import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { OutboundMessageModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { OptOutRepository } from '../application/ports/opt-out.repository';
import type { OutboundMessageRepository } from '../application/ports/outbound-message.repository';
import type { MessagingChannel } from '../domain/messaging-provider.entity';
import type { OptOut, OptOutSource } from '../domain/opt-out';
import { OutboundMessage, type OutboundStatus } from '../domain/outbound-message.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaOutboundMessageRepository implements OutboundMessageRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(message: OutboundMessage): Promise<void> {
    const data: OutboundMessageModel = {
      id: message.id,
      tenantId: this.tenant.tenantId,
      channel: message.channel,
      contactId: message.contactId,
      to: message.to,
      subject: message.subject,
      body: message.body,
      status: message.status,
      error: message.error,
      providerMessageId: message.providerMessageId,
      sentByMembershipId: message.sentByMembershipId,
      campaignId: message.campaignId,
      createdAt: message.createdAt,
      sentAt: message.sentAt,
      deliveredAt: message.deliveredAt,
      updatedAt: message.updatedAt,
    };
    await this.db.outboundMessage.upsert({
      where: { id: message.id, tenantId: data.tenantId },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<OutboundMessage | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.outboundMessage.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
    });
    return row ? toDomain(row) : null;
  }

  async listByContact(contactId: string, limit: number): Promise<OutboundMessage[]> {
    if (!UUID.test(contactId)) return [];
    const rows = await this.db.outboundMessage.findMany({
      where: { contactId, tenantId: this.tenant.tenantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map(toDomain);
  }
}

@Injectable()
export class PrismaOptOutRepository implements OptOutRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async add(optOut: OptOut): Promise<void> {
    const key = {
      tenantId: this.tenant.tenantId,
      channel: optOut.channel,
      address: optOut.address,
    };
    await this.db.optOut.upsert({
      where: { tenantId_channel_address: key },
      create: { ...key, source: optOut.source, createdAt: optOut.createdAt },
      update: {},
    });
  }

  async isOptedOut(channel: MessagingChannel, address: string): Promise<boolean> {
    const row = await this.db.optOut.findUnique({
      where: { tenantId_channel_address: { tenantId: this.tenant.tenantId, channel, address } },
      select: { address: true },
    });
    return row !== null;
  }

  async listFor(addresses: { channel: MessagingChannel; address: string }[]): Promise<OptOut[]> {
    const rows = await this.db.optOut.findMany({
      where: { tenantId: this.tenant.tenantId, OR: addresses },
    });
    return rows.map((row) => ({
      tenantId: row.tenantId,
      channel: row.channel as MessagingChannel,
      address: row.address,
      source: row.source as OptOutSource,
      createdAt: row.createdAt,
    }));
  }

  async remove(channel: MessagingChannel, address: string): Promise<void> {
    await this.db.optOut.deleteMany({
      where: { tenantId: this.tenant.tenantId, channel, address },
    });
  }
}

function toDomain(row: OutboundMessageModel): OutboundMessage {
  return OutboundMessage.restore(row.id, {
    tenantId: row.tenantId,
    channel: row.channel as MessagingChannel,
    contactId: row.contactId,
    to: row.to,
    subject: row.subject,
    body: row.body,
    status: row.status as OutboundStatus,
    error: row.error,
    providerMessageId: row.providerMessageId,
    sentByMembershipId: row.sentByMembershipId,
    campaignId: row.campaignId,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
    deliveredAt: row.deliveredAt,
    updatedAt: row.updatedAt,
  });
}
