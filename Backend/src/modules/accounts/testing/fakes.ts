import type { IdentityGateway, SessionTokens } from '../application/ports/identity.gateway';
import type { MembershipRepository } from '../application/ports/membership.repository';
import type { RoleRepository } from '../application/ports/role.repository';
import type { TenantRepository } from '../application/ports/tenant.repository';
import type { Membership } from '../domain/membership.entity';
import type { Role } from '../domain/role.entity';
import type { Slug } from '../domain/slug.vo';
import type { Tenant } from '../domain/tenant.entity';

export class InMemoryTenantRepository implements TenantRepository {
  readonly tenants: Tenant[] = [];

  save(tenant: Tenant): Promise<void> {
    this.tenants.push(tenant);
    return Promise.resolve();
  }

  findManyByIds(ids: string[]): Promise<Tenant[]> {
    return Promise.resolve(this.tenants.filter((t) => ids.includes(t.id)));
  }

  existsBySlug(slug: Slug): Promise<boolean> {
    return Promise.resolve(this.tenants.some((t) => t.slug.value === slug.value));
  }
}

export class InMemoryRoleRepository implements RoleRepository {
  readonly roles: Role[] = [];

  saveMany(roles: Role[]): Promise<void> {
    this.roles.push(...roles);
    return Promise.resolve();
  }
}

export class InMemoryMembershipRepository implements MembershipRepository {
  readonly memberships: Membership[] = [];

  save(membership: Membership): Promise<void> {
    this.memberships.push(membership);
    return Promise.resolve();
  }

  findActiveByUserId(userId: string): Promise<Membership[]> {
    return Promise.resolve(this.memberships.filter((m) => m.userId === userId && m.isActive));
  }
}

/**
 * Identity de mentira: usuários em memória, senha conferida em texto puro
 * e tokens que revelam a sessão aberta.
 */
export class FakeIdentityGateway implements IdentityGateway {
  readonly users: { id: string; email: string; password: string }[] = [];
  readonly sessions: { userId: string; tenantId: string; membershipId: string }[] = [];

  registerUser(input: { email: string; name: string; password: string }) {
    if (this.users.some((u) => u.email === input.email)) {
      return Promise.reject(new Error('email in use'));
    }
    const user = { id: `user-${this.users.length + 1}`, ...input };
    this.users.push(user);
    return Promise.resolve({ id: user.id });
  }

  authenticate(input: { email: string; password: string }) {
    const user = this.users.find((u) => u.email === input.email && u.password === input.password);
    return user ? Promise.resolve({ id: user.id }) : Promise.reject(new Error('invalid'));
  }

  startSession(input: {
    userId: string;
    tenantId: string;
    membershipId: string;
  }): Promise<SessionTokens> {
    this.sessions.push(input);
    return Promise.resolve({
      accessToken: `access-for-${input.tenantId}`,
      accessTokenExpiresInSeconds: 900,
      refreshToken: 'refresh',
      refreshTokenExpiresAt: new Date('2030-01-01'),
    });
  }
}
