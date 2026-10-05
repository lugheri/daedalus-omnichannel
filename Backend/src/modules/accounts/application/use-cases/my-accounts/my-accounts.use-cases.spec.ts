import type { Actor } from '../../../../../shared/application/actor-context';
import { AccountNotAccessibleError } from '../../../domain/errors/account-not-accessible.error';
import { Membership } from '../../../domain/membership.entity';
import { Slug } from '../../../domain/slug.vo';
import { Tenant } from '../../../domain/tenant.entity';
import {
  FakeIdentityGateway,
  InMemoryMembershipRepository,
  InMemoryTenantRepository,
} from '../../../testing/fakes';
import { ListMyAccountsUseCase, SwitchAccountUseCase } from './my-accounts.use-cases';

describe('My accounts', () => {
  let identity: FakeIdentityGateway;
  let memberships: InMemoryMembershipRepository;
  let tenants: InMemoryTenantRepository;
  const actor: Actor = {
    userId: 'user-1',
    tenantId: 'tenant-b',
    membershipId: 'membership-tenant-b',
    sessionId: 'session-current',
  };

  beforeEach(() => {
    identity = new FakeIdentityGateway();
    memberships = new InMemoryMembershipRepository();
    tenants = new InMemoryTenantRepository();
  });

  async function giveAccess(
    tenantId: string,
    name: string,
    opts: { suspended?: boolean; disabled?: boolean; userId?: string } = {},
  ) {
    await tenants.save(
      Tenant.restore(tenantId, {
        name,
        slug: Slug.fromName(tenantId),
        status: opts.suspended ? 'suspended' : 'active',
        createdAt: new Date(),
      }),
    );
    const membership = Membership.createActive(`membership-${tenantId}`, {
      tenantId,
      userId: opts.userId ?? 'user-1',
      roleId: 'role-1',
    });
    if (opts.disabled) membership.disable();
    await memberships.save(membership);
  }

  describe('ListMyAccountsUseCase', () => {
    it('lists only accounts the person can enter, by name', async () => {
      await giveAccess('tenant-b', 'Loja Zeta');
      await giveAccess('tenant-a', 'Agência Alfa');
      await giveAccess('tenant-s', 'Suspensa', { suspended: true });
      await giveAccess('tenant-d', 'Desligada', { disabled: true });
      await giveAccess('tenant-x', 'De outra pessoa', { userId: 'user-2' });

      const accounts = await new ListMyAccountsUseCase(memberships, tenants).execute(actor);

      expect(accounts.map((t) => t.name)).toEqual(['Agência Alfa', 'Loja Zeta']);
    });
  });

  describe('SwitchAccountUseCase', () => {
    const switchTo = (tenantId: string) =>
      new SwitchAccountUseCase(identity, memberships, tenants).execute(actor, tenantId);

    it('opens a session in the chosen account and ends the current one', async () => {
      await giveAccess('tenant-b', 'Loja Zeta');
      await giveAccess('tenant-a', 'Agência Alfa');

      const result = await switchTo('tenant-a');

      expect(result.tenant.id).toBe('tenant-a');
      expect(result.tokens.accessToken).toBe('access-for-tenant-a');
      expect(identity.sessions).toEqual([
        { userId: 'user-1', tenantId: 'tenant-a', membershipId: 'membership-tenant-a' },
      ]);
      expect(identity.revokedSessions).toEqual(['session-current']);
    });

    it.each([
      ['an account without membership', 'tenant-x'],
      ['a suspended account', 'tenant-s'],
      ['an account where the membership was disabled', 'tenant-d'],
    ])('refuses %s, keeping the current session', async (_, tenantId) => {
      await giveAccess('tenant-b', 'Loja Zeta');
      await giveAccess('tenant-s', 'Suspensa', { suspended: true });
      await giveAccess('tenant-d', 'Desligada', { disabled: true });
      await giveAccess('tenant-x', 'De outra pessoa', { userId: 'user-2' });

      await expect(switchTo(tenantId)).rejects.toBeInstanceOf(AccountNotAccessibleError);
      expect(identity.sessions).toEqual([]);
      expect(identity.revokedSessions).toEqual([]);
    });
  });
});
