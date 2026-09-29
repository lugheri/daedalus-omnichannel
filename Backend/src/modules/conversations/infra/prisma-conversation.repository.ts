import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import type { CursorPage } from '../../../shared/application/pagination';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { ConversationModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type {
  ConversationListQuery,
  ConversationRepository,
} from '../application/ports/conversation.repository';
import { Conversation, type ConversationStatus } from '../domain/conversation.entity';
import type { ConversationScope } from '../domain/visibility';
import { afterKeyset, decodeKeyset, encodeKeyset } from './keyset-cursor';
import { isUuid } from './uuid';

@Injectable()
export class PrismaConversationRepository implements ConversationRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(conversation: Conversation): Promise<void> {
    const data = toPersistence(conversation);
    await this.db.conversation.upsert({
      where: { id: data.id, tenantId: this.tenant.tenantId },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<Conversation | null> {
    if (!isUuid(id)) return null;
    const row = await this.db.conversation.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
    });
    return row ? toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Conversation[]> {
    const valid = [...new Set(ids.filter(isUuid))];
    if (valid.length === 0) return [];
    const rows = await this.db.conversation.findMany({
      where: { id: { in: valid }, tenantId: this.tenant.tenantId },
    });
    return rows.map(toDomain);
  }

  async findByChannelAndContact(
    channelId: string,
    contactId: string,
  ): Promise<Conversation | null> {
    const row = await this.db.conversation.findUnique({
      where: {
        tenantId_channelId_contactId: { tenantId: this.tenant.tenantId, channelId, contactId },
      },
    });
    return row ? toDomain(row) : null;
  }

  async list({
    scope,
    status,
    assignee,
    contactId,
    me,
    limit,
    cursor,
  }: ConversationListQuery): Promise<CursorPage<Conversation>> {
    const after = decodeKeyset(cursor);
    const where: Prisma.ConversationWhereInput = {
      tenantId: this.tenant.tenantId,
      ...(status && { status }),
      ...(contactId && { contactId }),
      AND: [
        scopeFilter(scope),
        assignee === 'me' ? { assigneeId: me } : assignee === 'none' ? { assigneeId: null } : {},
        // Depois do último item da página anterior, na ordem (data, id).
        after ? afterKeyset('lastMessageAt', after) : {},
      ],
    };

    const rows = await this.db.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(toDomain);
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeKeyset({ at: last.lastMessageAt, id: last.id }) : null,
    };
  }

  async clearTeam(teamId: string): Promise<void> {
    await this.db.conversation.updateMany({
      where: { teamId, tenantId: this.tenant.tenantId },
      data: { teamId: null },
    });
  }
}

/** A regra de domain/visibility.ts (isVisible), traduzida para consulta. */
function scopeFilter(scope: ConversationScope): Prisma.ConversationWhereInput {
  if (scope.kind === 'all') return {};
  const mine = { assigneeId: scope.membershipId };
  const myTeams = { teamId: { in: [...scope.teamIds] } };
  if (scope.kind === 'team') {
    return { OR: [mine, myTeams, { teamId: null, assigneeId: null }] };
  }
  return { OR: [mine, { assigneeId: null, OR: [{ teamId: null }, myTeams] }] };
}

function toDomain(row: ConversationModel): Conversation {
  return Conversation.restore(row.id, {
    tenantId: row.tenantId,
    channelId: row.channelId,
    contactId: row.contactId,
    status: row.status as ConversationStatus,
    assigneeId: row.assigneeId,
    teamId: row.teamId,
    dispositionId: row.dispositionId,
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: row.lastMessagePreview,
    unreadCount: row.unreadCount,
    createdAt: row.createdAt,
  });
}

function toPersistence(conversation: Conversation): ConversationModel {
  return {
    id: conversation.id,
    tenantId: conversation.tenantId,
    channelId: conversation.channelId,
    contactId: conversation.contactId,
    status: conversation.status,
    assigneeId: conversation.assigneeId,
    teamId: conversation.teamId,
    dispositionId: conversation.dispositionId,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    unreadCount: conversation.unreadCount,
    createdAt: conversation.createdAt,
  };
}
