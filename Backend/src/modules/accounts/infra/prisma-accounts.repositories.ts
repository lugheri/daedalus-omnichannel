import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { MembershipRepository } from '../application/ports/membership.repository';
import type { RoleRepository } from '../application/ports/role.repository';
import type { TenantRepository } from '../application/ports/tenant.repository';
import type { Membership } from '../domain/membership.entity';
import type { Role } from '../domain/role.entity';
import type { Slug } from '../domain/slug.vo';
import type { Tenant } from '../domain/tenant.entity';
import { MembershipMapper, RoleMapper, TenantMapper } from './accounts.mappers';

/**
 * Os repositórios de accounts ficam num arquivo só por serem curtos.
 * Tabelas de tenants/memberships são a FONTE do tenant: por isso não filtram
 * pelo TenantContext (quem está logando ainda não tem tenant).
 */
@Injectable()
export class PrismaTenantRepository implements TenantRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  async save(tenant: Tenant): Promise<void> {
    const data = TenantMapper.toPersistence(tenant);
    await this.txHost.tx.tenant.upsert({ where: { id: data.id }, create: data, update: data });
  }

  async findManyByIds(ids: string[]): Promise<Tenant[]> {
    if (ids.length === 0) return [];
    const rows = await this.txHost.tx.tenant.findMany({
      where: { id: { in: ids } },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => TenantMapper.toDomain(row));
  }

  async existsBySlug(slug: Slug): Promise<boolean> {
    const count = await this.txHost.tx.tenant.count({ where: { slug: slug.value } });
    return count > 0;
  }
}

@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  async saveMany(roles: Role[]): Promise<void> {
    await this.txHost.tx.role.createMany({
      data: roles.map((role) => RoleMapper.toPersistence(role)),
    });
  }
}

@Injectable()
export class PrismaMembershipRepository implements MembershipRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  async save(membership: Membership): Promise<void> {
    const data = MembershipMapper.toPersistence(membership);
    await this.txHost.tx.membership.upsert({ where: { id: data.id }, create: data, update: data });
  }

  async findActiveByUserId(userId: string): Promise<Membership[]> {
    const rows = await this.txHost.tx.membership.findMany({
      where: { userId, status: 'active' },
    });
    return rows.map((row) => MembershipMapper.toDomain(row));
  }
}
