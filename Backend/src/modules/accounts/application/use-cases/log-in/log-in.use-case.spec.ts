import { AccountAccessDeniedError } from '../../../domain/errors/account-access-denied.error';
import { Membership } from '../../../domain/membership.entity';
import { Slug } from '../../../domain/slug.vo';
import { Tenant } from '../../../domain/tenant.entity';
import {
  FakeIdentityGateway,
  InMemoryMembershipRepository,
  InMemoryTenantRepository,
} from '../../../testing/fakes';
import { LogInUseCase } from './log-in.use-case';

describe('LogInUseCase', () => {
  let identity: FakeIdentityGateway;
  let memberships: InMemoryMembershipRepository;
  let tenants: InMemoryTenantRepository;
  let useCase: LogInUseCase;
  let userId: string;

  beforeEach(async () => {
    identity = new FakeIdentityGateway();
    memberships = new InMemoryMembershipRepository();
    tenants = new InMemoryTenantRepository();
    useCase = new LogInUseCase(identity, memberships, tenants);

    ({ id: userId } = await identity.registerUser({
      email: 'ana@example.com',
      name: 'Ana',
      password: 'super-secret',
    }));
  });

  async function giveAccess(tenantId: string, opts: { suspended?: boolean } = {}) {
    const tenant = Tenant.restore(tenantId, {
      name: `Account ${tenantId}`,
      slug: Slug.fromName(tenantId),
      status: opts.suspended ? 'suspended' : 'active',
      createdAt: new Date(),
    });
    await tenants.save(tenant);
    await memberships.save(
      Membership.createActive(`membership-${tenantId}`, { tenantId, userId, roleId: 'role-1' }),
    );
  }

  const logIn = (tenantId?: string) =>
    useCase.execute({ email: 'ana@example.com', password: 'super-secret', tenantId });

  it('logs straight in when the user has a single account', async () => {
    await giveAccess('tenant-a');

    const result = await logIn();

    expect(result.kind).toBe('authenticated');
    expect(identity.sessions[0]).toEqual({
      userId,
      tenantId: 'tenant-a',
      membershipId: 'membership-tenant-a',
    });
  });

  it('asks which account to use when there are several', async () => {
    await giveAccess('tenant-a');
    await giveAccess('tenant-b');

    const result = await logIn();

    expect(result.kind).toBe('tenant-selection-required');
    expect(result.kind === 'tenant-selection-required' && result.tenants.map((t) => t.id)).toEqual([
      'tenant-a',
      'tenant-b',
    ]);
    expect(identity.sessions).toHaveLength(0);
  });

  it('logs into the chosen account', async () => {
    await giveAccess('tenant-a');
    await giveAccess('tenant-b');

    const result = await logIn('tenant-b');

    expect(result.kind === 'authenticated' && result.tenant.id).toBe('tenant-b');
  });

  it('denies an account the user does not belong to', async () => {
    await giveAccess('tenant-a');

    await expect(logIn('tenant-x')).rejects.toThrow(AccountAccessDeniedError);
  });

  it('denies access to a suspended account', async () => {
    await giveAccess('tenant-a', { suspended: true });

    await expect(logIn()).rejects.toThrow(AccountAccessDeniedError);
  });

  it('propagates invalid credentials without looking at memberships', async () => {
    await giveAccess('tenant-a');

    await expect(
      useCase.execute({ email: 'ana@example.com', password: 'wrong-password' }),
    ).rejects.toThrow('invalid');
  });
});
