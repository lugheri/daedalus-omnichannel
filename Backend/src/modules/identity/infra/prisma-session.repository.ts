import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import type { SessionModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { SessionRepository } from '../application/ports/session.repository';
import { Session } from '../domain/session.entity';

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(session: Session): Promise<void> {
    const data = toPersistence(session);
    await this.db.session.upsert({ where: { id: data.id }, create: data, update: data });
  }

  async findUnrevokedByMembershipId(membershipId: string): Promise<Session[]> {
    const rows = await this.db.session.findMany({ where: { membershipId, revokedAt: null } });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Session | null> {
    // O id vem do cliente (dentro do refresh token): se não for um UUID,
    // o Postgres recusaria a consulta. Tratamos como "não encontrado".
    if (!UUID.test(id)) return null;
    const row = await this.db.session.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDomain(row: SessionModel): Session {
  return Session.restore(row.id, {
    userId: row.userId,
    tenantId: row.tenantId,
    membershipId: row.membershipId,
    refreshTokenHash: row.refreshTokenHash,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    lastRotatedAt: row.lastRotatedAt,
    revokedAt: row.revokedAt,
  });
}

function toPersistence(session: Session): SessionModel {
  return {
    id: session.id,
    userId: session.userId,
    tenantId: session.tenantId,
    membershipId: session.membershipId,
    refreshTokenHash: session.refreshTokenHash,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    lastRotatedAt: session.lastRotatedAt,
    revokedAt: session.revokedAt,
  };
}
