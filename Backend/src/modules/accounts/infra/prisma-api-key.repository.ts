import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import type { ApiKeyModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { ApiKeyRepository } from '../application/ports/api-key.repository';
import { ApiKey } from '../domain/api-key.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaApiKeyRepository implements ApiKeyRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(key: ApiKey): Promise<void> {
    const data = toPersistence(key);
    await this.db.apiKey.upsert({ where: { id: key.id }, create: data, update: data });
  }

  async findInTenant(tenantId: string, id: string): Promise<ApiKey | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.apiKey.findFirst({ where: { id, tenantId } });
    return row ? toDomain(row) : null;
  }

  async findForAuthentication(id: string): Promise<ApiKey | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.apiKey.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async listByTenant(tenantId: string): Promise<ApiKey[]> {
    const rows = await this.db.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }
}

function toDomain(row: ApiKeyModel): ApiKey {
  return ApiKey.restore(row.id, {
    tenantId: row.tenantId,
    name: row.name,
    secretHash: row.secretHash,
    hint: row.hint,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
  });
}

function toPersistence(key: ApiKey): ApiKeyModel {
  return {
    id: key.id,
    tenantId: key.tenantId,
    name: key.name,
    secretHash: key.secretHash,
    hint: key.hint,
    createdByMembershipId: key.createdByMembershipId,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
  };
}
