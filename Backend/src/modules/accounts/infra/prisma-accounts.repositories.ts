import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { InvitationRepository } from '../application/ports/invitation.repository';
import type { MembershipRepository } from '../application/ports/membership.repository';
import type { RoleRepository } from '../application/ports/role.repository';
import type { TenantRepository } from '../application/ports/tenant.repository';
import { AlreadyMemberError } from '../domain/errors/already-member.error';
import { RoleNameTakenError } from '../domain/errors/role-name-taken.error';
import type { Invitation } from '../domain/invitation.entity';
import type { Membership } from '../domain/membership.entity';
import type { Role } from '../domain/role.entity';
import type { Slug } from '../domain/slug.vo';
import type { Tenant } from '../domain/tenant.entity';
import { InvitationMapper, MembershipMapper, RoleMapper, TenantMapper } from './accounts.mappers';

/**
 * Os repositórios de accounts ficam num arquivo só por serem curtos.
 * O `tenantId` é explícito nos métodos (ver MembershipRepository): o accounts
 * é a origem do tenant e parte dos fluxos (login, aceite de convite) não tem
 * ator autenticado.
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

  async findById(id: string): Promise<Tenant | null> {
    const row = await this.txHost.tx.tenant.findUnique({ where: { id } });
    return row ? TenantMapper.toDomain(row) : null;
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

  async save(role: Role): Promise<void> {
    const data = RoleMapper.toPersistence(role);
    try {
      await this.txHost.tx.role.upsert({ where: { id: data.id }, create: data, update: data });
    } catch (error) {
      if (isUniqueViolation(error, 'roles_tenant_id_name_key')) throw new RoleNameTakenError();
      throw error;
    }
  }

  async saveMany(roles: Role[]): Promise<void> {
    await this.txHost.tx.role.createMany({
      data: roles.map((role) => RoleMapper.toPersistence(role)),
    });
  }

  async findById(id: string): Promise<Role | null> {
    const row = await this.txHost.tx.role.findUnique({ where: { id } });
    return row ? RoleMapper.toDomain(row) : null;
  }

  async findInTenant(tenantId: string, id: string): Promise<Role | null> {
    const row = await this.txHost.tx.role.findFirst({ where: { id, tenantId } });
    return row ? RoleMapper.toDomain(row) : null;
  }

  async listByTenant(tenantId: string): Promise<Role[]> {
    const rows = await this.txHost.tx.role.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => RoleMapper.toDomain(row));
  }

  async delete(role: Role): Promise<void> {
    await this.txHost.tx.role.delete({ where: { id: role.id } });
  }
}

@Injectable()
export class PrismaMembershipRepository implements MembershipRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  async save(membership: Membership): Promise<void> {
    const data = MembershipMapper.toPersistence(membership);
    try {
      await this.txHost.tx.membership.upsert({
        where: { id: data.id },
        create: data,
        update: data,
      });
    } catch (error) {
      // Dois aceites simultâneos do mesmo convite/pessoa: o segundo esbarra aqui.
      if (isUniqueViolation(error, 'memberships_tenant_id_user_id_key')) {
        throw new AlreadyMemberError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Membership | null> {
    const row = await this.txHost.tx.membership.findUnique({ where: { id } });
    return row ? MembershipMapper.toDomain(row) : null;
  }

  async findInTenant(tenantId: string, id: string): Promise<Membership | null> {
    if (!UUID.test(id)) return null;
    const row = await this.txHost.tx.membership.findFirst({ where: { id, tenantId } });
    return row ? MembershipMapper.toDomain(row) : null;
  }

  async findByUser(tenantId: string, userId: string): Promise<Membership | null> {
    const row = await this.txHost.tx.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    return row ? MembershipMapper.toDomain(row) : null;
  }

  async listByTenant(tenantId: string): Promise<Membership[]> {
    const rows = await this.txHost.tx.membership.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => MembershipMapper.toDomain(row));
  }

  countActiveWithRole(tenantId: string, roleId: string): Promise<number> {
    return this.txHost.tx.membership.count({ where: { tenantId, roleId, status: 'active' } });
  }

  async listIdsWithRole(tenantId: string, roleId: string): Promise<string[]> {
    const rows = await this.txHost.tx.membership.findMany({
      where: { tenantId, roleId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async findActiveByUserId(userId: string): Promise<Membership[]> {
    const rows = await this.txHost.tx.membership.findMany({
      where: { userId, status: 'active' },
    });
    return rows.map((row) => MembershipMapper.toDomain(row));
  }
}

@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
  ) {}

  async save(invitation: Invitation): Promise<void> {
    const data = InvitationMapper.toPersistence(invitation);
    await this.txHost.tx.invitation.upsert({ where: { id: data.id }, create: data, update: data });
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const row = await this.txHost.tx.invitation.findUnique({ where: { tokenHash } });
    return row ? InvitationMapper.toDomain(row) : null;
  }

  async findInTenant(tenantId: string, id: string): Promise<Invitation | null> {
    if (!UUID.test(id)) return null;
    const row = await this.txHost.tx.invitation.findFirst({ where: { id, tenantId } });
    return row ? InvitationMapper.toDomain(row) : null;
  }

  async findPendingByEmail(tenantId: string, email: string): Promise<Invitation | null> {
    const row = await this.txHost.tx.invitation.findFirst({
      where: { tenantId, email, status: 'pending' },
    });
    return row ? InvitationMapper.toDomain(row) : null;
  }

  async listPending(tenantId: string): Promise<Invitation[]> {
    const rows = await this.txHost.tx.invitation.findMany({
      where: { tenantId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => InvitationMapper.toDomain(row));
  }

  countPendingWithRole(tenantId: string, roleId: string): Promise<number> {
    return this.txHost.tx.invitation.count({ where: { tenantId, roleId, status: 'pending' } });
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes(constraint)
  );
}
