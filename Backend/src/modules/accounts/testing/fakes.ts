import type { ApiKeySecretGenerator } from '../application/ports/api-key-secret-generator';
import type { ApiKeyRepository } from '../application/ports/api-key.repository';
import type { ApiKey } from '../domain/api-key.entity';
import type { AccountAccess } from '../application/account-access';
import type { AccessCache } from '../application/ports/access-cache';
import type {
  IdentityGateway,
  SessionTokens,
  UserInfo,
} from '../application/ports/identity.gateway';
import type { InvitationRepository } from '../application/ports/invitation.repository';
import type { InvitationTokenGenerator } from '../application/ports/invitation-token-generator';
import type { MembershipRepository } from '../application/ports/membership.repository';
import type { RoleRepository } from '../application/ports/role.repository';
import type { TenantRepository } from '../application/ports/tenant.repository';
import type { Invitation } from '../domain/invitation.entity';
import type { Membership } from '../domain/membership.entity';
import type { Role } from '../domain/role.entity';
import type { Slug } from '../domain/slug.vo';
import type { Tenant } from '../domain/tenant.entity';

/** Guarda em memória, substituindo pelo id (upsert) — base dos repositórios falsos. */
class Store<T extends { id: string }> {
  items: T[] = [];

  upsert(item: T): void {
    this.items = [...this.items.filter((i) => i.id !== item.id), item];
  }

  find(predicate: (item: T) => boolean): T | null {
    return this.items.find(predicate) ?? null;
  }
}

export class InMemoryTenantRepository implements TenantRepository {
  private readonly store = new Store<Tenant>();

  get tenants() {
    return this.store.items;
  }

  save(tenant: Tenant): Promise<void> {
    this.store.upsert(tenant);
    return Promise.resolve();
  }

  findById(id: string): Promise<Tenant | null> {
    return Promise.resolve(this.store.find((t) => t.id === id));
  }

  findManyByIds(ids: string[]): Promise<Tenant[]> {
    return Promise.resolve(this.tenants.filter((t) => ids.includes(t.id)));
  }

  existsBySlug(slug: Slug): Promise<boolean> {
    return Promise.resolve(this.tenants.some((t) => t.slug.value === slug.value));
  }
}

export class InMemoryRoleRepository implements RoleRepository {
  private readonly store = new Store<Role>();

  get roles() {
    return this.store.items;
  }

  save(role: Role): Promise<void> {
    this.store.upsert(role);
    return Promise.resolve();
  }

  saveMany(roles: Role[]): Promise<void> {
    roles.forEach((role) => this.store.upsert(role));
    return Promise.resolve();
  }

  findById(id: string): Promise<Role | null> {
    return Promise.resolve(this.store.find((r) => r.id === id));
  }

  findInTenant(tenantId: string, id: string): Promise<Role | null> {
    return Promise.resolve(this.store.find((r) => r.id === id && r.tenantId === tenantId));
  }

  listByTenant(tenantId: string): Promise<Role[]> {
    return Promise.resolve(this.roles.filter((r) => r.tenantId === tenantId));
  }

  delete(role: Role): Promise<void> {
    this.store.items = this.roles.filter((r) => r.id !== role.id);
    return Promise.resolve();
  }
}

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly store = new Store<Membership>();

  get memberships() {
    return this.store.items;
  }

  save(membership: Membership): Promise<void> {
    this.store.upsert(membership);
    return Promise.resolve();
  }

  findById(id: string): Promise<Membership | null> {
    return Promise.resolve(this.store.find((m) => m.id === id));
  }

  findInTenant(tenantId: string, id: string): Promise<Membership | null> {
    return Promise.resolve(this.store.find((m) => m.id === id && m.tenantId === tenantId));
  }

  findByUser(tenantId: string, userId: string): Promise<Membership | null> {
    return Promise.resolve(this.store.find((m) => m.tenantId === tenantId && m.userId === userId));
  }

  listByTenant(tenantId: string): Promise<Membership[]> {
    return Promise.resolve(this.memberships.filter((m) => m.tenantId === tenantId));
  }

  countActiveWithRole(tenantId: string, roleId: string): Promise<number> {
    return Promise.resolve(
      this.memberships.filter((m) => m.tenantId === tenantId && m.roleId === roleId && m.isActive)
        .length,
    );
  }

  listIdsWithRole(tenantId: string, roleId: string): Promise<string[]> {
    return Promise.resolve(
      this.memberships
        .filter((m) => m.tenantId === tenantId && m.roleId === roleId)
        .map((m) => m.id),
    );
  }

  findActiveByUserId(userId: string): Promise<Membership[]> {
    return Promise.resolve(this.memberships.filter((m) => m.userId === userId && m.isActive));
  }
}

export class InMemoryInvitationRepository implements InvitationRepository {
  private readonly store = new Store<Invitation>();

  get invitations() {
    return this.store.items;
  }

  save(invitation: Invitation): Promise<void> {
    this.store.upsert(invitation);
    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    return Promise.resolve(this.store.find((i) => i.tokenHash === tokenHash));
  }

  findInTenant(tenantId: string, id: string): Promise<Invitation | null> {
    return Promise.resolve(this.store.find((i) => i.id === id && i.tenantId === tenantId));
  }

  findPendingByEmail(tenantId: string, email: string): Promise<Invitation | null> {
    return Promise.resolve(
      this.store.find(
        (i) => i.tenantId === tenantId && i.email === email && i.status === 'pending',
      ),
    );
  }

  listPending(tenantId: string): Promise<Invitation[]> {
    return Promise.resolve(
      this.invitations.filter((i) => i.tenantId === tenantId && i.status === 'pending'),
    );
  }

  countPendingWithRole(tenantId: string, roleId: string): Promise<number> {
    return Promise.resolve(
      this.invitations.filter(
        (i) => i.tenantId === tenantId && i.roleId === roleId && i.status === 'pending',
      ).length,
    );
  }
}

/** Tokens previsíveis: `invite-token-1`... e hash legível. */
export class SequentialInvitationTokenGenerator implements InvitationTokenGenerator {
  private next = 1;

  generate() {
    const token = `invite-token-${this.next++}`;
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return `hash(${token})`;
  }
}

export class InMemoryAccessCache implements AccessCache {
  readonly entries = new Map<string, AccountAccess>();
  readonly invalidated: string[] = [];
  hits = 0;

  get(membershipId: string): Promise<AccountAccess | null> {
    const access = this.entries.get(membershipId) ?? null;
    if (access) this.hits++;
    return Promise.resolve(access);
  }

  set(access: AccountAccess): Promise<void> {
    this.entries.set(access.membershipId, access);
    return Promise.resolve();
  }

  invalidate(membershipIds: string[]): Promise<void> {
    membershipIds.forEach((id) => this.entries.delete(id));
    this.invalidated.push(...membershipIds);
    return Promise.resolve();
  }
}

/**
 * Identity de mentira: usuários em memória, senha conferida em texto puro
 * e tokens que revelam a sessão aberta.
 */
export class FakeIdentityGateway implements IdentityGateway {
  readonly users: (UserInfo & { password: string })[] = [];
  readonly sessions: { userId: string; tenantId: string; membershipId: string }[] = [];
  readonly revokedMemberships: string[] = [];

  registerUser(input: { email: string; name: string; password: string }) {
    if (this.users.some((u) => u.email === input.email)) {
      return Promise.reject(new Error('email in use'));
    }
    if (!input.name.trim()) return Promise.reject(new Error('name required'));
    const user = { id: `user-${this.users.length + 1}`, ...input };
    this.users.push(user);
    return Promise.resolve({ id: user.id });
  }

  authenticate(input: { email: string; password: string }) {
    const user = this.users.find((u) => u.email === input.email && u.password === input.password);
    return user ? Promise.resolve({ id: user.id }) : Promise.reject(new Error('invalid'));
  }

  findUser(id: string) {
    return Promise.resolve(this.toInfo(this.users.find((u) => u.id === id)));
  }

  findUserByEmail(email: string) {
    return Promise.resolve(this.toInfo(this.users.find((u) => u.email === email)));
  }

  findUsers(ids: string[]) {
    return Promise.resolve(
      this.users.filter((u) => ids.includes(u.id)).map((u) => this.toInfo(u)!),
    );
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

  revokeMembershipSessions(membershipId: string): Promise<void> {
    this.revokedMemberships.push(membershipId);
    return Promise.resolve();
  }

  private toInfo(user: (UserInfo & { password: string }) | undefined): UserInfo | null {
    return user ? { id: user.id, name: user.name, email: user.email } : null;
  }
}

/** Chaves de API em memória (mesmo contrato do repositório real). */
export class InMemoryApiKeyRepository implements ApiKeyRepository {
  private keys: ApiKey[] = [];

  save(key: ApiKey): Promise<void> {
    this.keys = [...this.keys.filter((k) => k.id !== key.id), key];
    return Promise.resolve();
  }

  findInTenant(tenantId: string, id: string): Promise<ApiKey | null> {
    return Promise.resolve(this.keys.find((k) => k.id === id && k.tenantId === tenantId) ?? null);
  }

  findForAuthentication(id: string): Promise<ApiKey | null> {
    return Promise.resolve(this.keys.find((k) => k.id === id) ?? null);
  }

  listByTenant(tenantId: string): Promise<ApiKey[]> {
    return Promise.resolve(this.keys.filter((k) => k.tenantId === tenantId).reverse());
  }
}

/** Segredos previsíveis (`secret-1`, `secret-2`...) e um "hash" legível. */
export class SequentialApiKeySecretGenerator implements ApiKeySecretGenerator {
  private next = 0;

  generate() {
    const secret = `secret-${++this.next}`;
    return { secret, hash: this.hash(secret) };
  }

  hash(secret: string): string {
    return `hash(${secret})`;
  }

  matches(secret: string, hash: string): boolean {
    return this.hash(secret) === hash;
  }
}
