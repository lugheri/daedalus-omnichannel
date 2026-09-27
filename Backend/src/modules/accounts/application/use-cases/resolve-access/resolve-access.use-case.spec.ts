import type { Actor } from '../../../../../shared/application/actor-context';
import { DEFAULT_ROLES } from '../../../domain/default-roles';
import { AccountAccessDeniedError } from '../../../domain/errors/account-access-denied.error';
import { Membership } from '../../../domain/membership.entity';
import { Role } from '../../../domain/role.entity';
import { Slug } from '../../../domain/slug.vo';
import { Tenant, type TenantStatus } from '../../../domain/tenant.entity';
import {
  InMemoryAccessCache,
  InMemoryMembershipRepository,
  InMemoryRoleRepository,
  InMemoryTenantRepository,
} from '../../../testing/fakes';
import { ResolveAccessUseCase } from './resolve-access.use-case';

describe('ResolveAccessUseCase', () => {
  let memberships: InMemoryMembershipRepository;
  let tenants: InMemoryTenantRepository;
  let cache: InMemoryAccessCache;
  let useCase: ResolveAccessUseCase;

  const actor: Actor = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    sessionId: 'session-1',
  };

  async function setUp(opts: { tenantStatus?: TenantStatus; roleKey?: string } = {}) {
    const template = DEFAULT_ROLES.find((r) => r.key === (opts.roleKey ?? 'agent'))!;
    const roles = new InMemoryRoleRepository();
    await roles.saveMany([Role.fromTemplate('role-1', 'tenant-1', template)]);
    await tenants.save(
      Tenant.restore('tenant-1', {
        name: 'Loja',
        slug: Slug.fromName('loja'),
        status: opts.tenantStatus ?? 'active',
        createdAt: new Date(),
      }),
    );
    await memberships.save(
      Membership.createActive('membership-1', {
        tenantId: 'tenant-1',
        userId: 'user-1',
        roleId: 'role-1',
      }),
    );
    useCase = new ResolveAccessUseCase(memberships, roles, tenants, cache);
  }

  beforeEach(() => {
    memberships = new InMemoryMembershipRepository();
    tenants = new InMemoryTenantRepository();
    cache = new InMemoryAccessCache();
  });

  it("returns the role's current permissions", async () => {
    await setUp({ roleKey: 'agent' });

    const access = await useCase.execute(actor);

    expect(access.role.key).toBe('agent');
    expect(access.permissions).toContain('contacts:view');
    expect(access.permissions).not.toContain('members:manage');
  });

  it('serves the next request from the cache', async () => {
    await setUp();
    await useCase.execute(actor);

    await useCase.execute(actor);

    expect(cache.hits).toBe(1);
  });

  it('denies a disabled membership', async () => {
    await setUp();
    await memberships.save(
      Membership.restore('membership-1', {
        tenantId: 'tenant-1',
        userId: 'user-1',
        roleId: 'role-1',
        status: 'disabled',
        createdAt: new Date(),
      }),
    );

    await expect(useCase.execute(actor)).rejects.toThrow(AccountAccessDeniedError);
  });

  it('denies access to a suspended account', async () => {
    await setUp({ tenantStatus: 'suspended' });

    await expect(useCase.execute(actor)).rejects.toThrow(AccountAccessDeniedError);
  });

  it('denies a token whose membership belongs to someone else', async () => {
    await setUp();

    await expect(useCase.execute({ ...actor, userId: 'intruder' })).rejects.toThrow(
      AccountAccessDeniedError,
    );
  });

  it('checks ownership even when the access comes from the cache', async () => {
    await setUp();
    await useCase.execute(actor);

    await expect(useCase.execute({ ...actor, tenantId: 'other-tenant' })).rejects.toThrow(
      AccountAccessDeniedError,
    );
  });

  it('does not cache a denial', async () => {
    await setUp({ tenantStatus: 'suspended' });
    await expect(useCase.execute(actor)).rejects.toThrow(AccountAccessDeniedError);

    expect(cache.entries.size).toBe(0);
  });
});
