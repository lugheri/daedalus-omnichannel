import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import type { CursorPage, PageRequest } from '../../../shared/application/pagination';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { MessageModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { MessageRepository } from '../application/ports/message.repository';
import {
  Message,
  type MessageDirection,
  type MessageKind,
  type MessageStatus,
} from '../domain/message.entity';
import { afterKeyset, decodeKeyset, encodeKeyset } from './keyset-cursor';
import { isUuid } from './uuid';

@Injectable()
export class PrismaMessageRepository implements MessageRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(message: Message): Promise<void> {
    const data = toPersistence(message);
    await this.db.message.upsert({
      where: { id: data.id, tenantId: this.tenant.tenantId },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<Message | null> {
    if (!isUuid(id)) return null;
    const row = await this.db.message.findFirst({ where: { id, tenantId: this.tenant.tenantId } });
    return row ? toDomain(row) : null;
  }

  async existsByExternalId(channelId: string, externalId: string): Promise<boolean> {
    const count = await this.db.message.count({
      where: { channelId, externalId, tenantId: this.tenant.tenantId },
    });
    return count > 0;
  }

  async listByConversation(
    conversationId: string,
    { limit, cursor }: PageRequest,
  ): Promise<CursorPage<Message>> {
    const after = decodeKeyset(cursor);
    const rows = await this.db.message.findMany({
      where: {
        tenantId: this.tenant.tenantId,
        conversationId,
        ...(after && afterKeyset('sentAt', after)),
      },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(toDomain);
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeKeyset({ at: last.sentAt, id: last.id }) : null,
    };
  }
}

function toDomain(row: MessageModel): Message {
  return Message.restore(row.id, {
    tenantId: row.tenantId,
    conversationId: row.conversationId,
    channelId: row.channelId,
    direction: row.direction as MessageDirection,
    kind: row.kind as MessageKind,
    text: row.text,
    externalId: row.externalId,
    status: row.status as MessageStatus,
    senderMembershipId: row.senderMembershipId,
    automated: row.automated,
    media:
      row.mediaKey && row.mediaMimeType
        ? {
            key: row.mediaKey,
            mimeType: row.mediaMimeType,
            size: row.mediaSize ?? 0,
            fileName: row.mediaFileName,
          }
        : null,
    error: row.error,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
  });
}

function toPersistence(message: Message): MessageModel {
  return {
    id: message.id,
    tenantId: message.tenantId,
    conversationId: message.conversationId,
    channelId: message.channelId,
    direction: message.direction,
    kind: message.kind,
    text: message.text,
    externalId: message.externalId,
    status: message.status,
    senderMembershipId: message.senderMembershipId,
    automated: message.automated,
    mediaKey: message.media?.key ?? null,
    mediaMimeType: message.media?.mimeType ?? null,
    mediaSize: message.media?.size ?? null,
    mediaFileName: message.media?.fileName ?? null,
    error: message.error,
    sentAt: message.sentAt,
    createdAt: message.createdAt,
  };
}
