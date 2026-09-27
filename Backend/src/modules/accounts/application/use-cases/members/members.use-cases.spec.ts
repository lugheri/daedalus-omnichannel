import { CannotDisableSelfError } from '../../../domain/errors/cannot-disable-self.error';
import { CannotGrantPermissionError } from '../../../domain/errors/cannot-grant-permission.error';
import { LastOwnerError } from '../../../domain/errors/last-owner.error';
import { MemberNotFoundError } from '../../../domain/errors/member-not-found.error';
import { accountScenario, roleId, type AccountScenario } from '../../../testing/scenario';
import { ChangeMemberRoleUseCase } from './change-member-role.use-case';
import { ListMembersUseCase } from './list-members.use-case';
import { SetMemberStatusUseCase } from './set-member-status.use-case';

describe('Member management', () => {
  let s: AccountScenario;
  let changeRole: ChangeMemberRoleUseCase;
  let setStatus: SetMemberStatusUseCase;

  beforeEach(async () => {
    s = await accountScenario();
    changeRole = new ChangeMemberRoleUseCase(
      s.currentAccess,
      s.memberships,
      s.roles,
      s.cache,
      s.unitOfWork,
    );
    setStatus = new SetMemberStatusUseCase(
      s.currentAccess,
      s.memberships,
      s.roles,
      s.cache,
      s.identity,
      s.unitOfWork,
    );
    await s.addMember('owner', 'owner');
    await s.addMember('admin', 'admin');
    await s.addMember('agent', 'agent');
  });

  it('lists members with their user and role', async () => {
    await s.actAs('m-admin');

    const members = await new ListMembersUseCase(
      s.currentAccess,
      s.memberships,
      s.roles,
      s.identity,
    ).execute();

    expect(members.map((m) => `${m.user.name}:${m.role.key}`)).toEqual([
      'owner:owner',
      'admin:admin',
      'agent:agent',
    ]);
  });

  describe('changing roles', () => {
    it('lets an admin promote an agent to supervisor, invalidating their cached access', async () => {
      await s.actAs('m-admin');

      await changeRole.execute({ membershipId: 'm-agent', roleId: roleId('supervisor') });

      expect((await s.memberships.findById('m-agent'))?.roleId).toBe(roleId('supervisor'));
      expect(s.cache.invalidated).toContain('m-agent');
    });

    it('does not let an admin make someone Owner (cannot grant what they lack)', async () => {
      await s.actAs('m-admin');

      await expect(
        changeRole.execute({ membershipId: 'm-agent', roleId: roleId('owner') }),
      ).rejects.toThrow(CannotGrantPermissionError);
    });

    it('does not let an admin demote the Owner (cannot manage someone above them)', async () => {
      await s.actAs('m-admin');

      await expect(
        changeRole.execute({ membershipId: 'm-owner', roleId: roleId('agent') }),
      ).rejects.toThrow(CannotGrantPermissionError);
    });

    it('never leaves the account without an Owner', async () => {
      await s.actAs('m-owner');

      await expect(
        changeRole.execute({ membershipId: 'm-owner', roleId: roleId('admin') }),
      ).rejects.toThrow(LastOwnerError);
    });

    it('allows handing over ownership when there is another Owner', async () => {
      await s.addMember('owner2', 'owner');
      await s.actAs('m-owner');

      await changeRole.execute({ membershipId: 'm-owner', roleId: roleId('admin') });

      expect((await s.memberships.findById('m-owner'))?.roleId).toBe(roleId('admin'));
    });

    it('does not reach members of other accounts', async () => {
      await s.actAs('m-admin');

      await expect(
        changeRole.execute({ membershipId: 'm-from-another-tenant', roleId: roleId('agent') }),
      ).rejects.toThrow(MemberNotFoundError);
    });
  });

  describe('disabling and enabling', () => {
    it('disabling cuts access immediately: cache invalidated and sessions revoked', async () => {
      await s.actAs('m-admin');

      await setStatus.execute({ membershipId: 'm-agent', active: false });

      expect((await s.memberships.findById('m-agent'))?.isActive).toBe(false);
      expect(s.cache.invalidated).toContain('m-agent');
      expect(s.identity.revokedMemberships).toEqual(['m-agent']);
    });

    it('nobody can disable themselves', async () => {
      await s.actAs('m-admin');

      await expect(setStatus.execute({ membershipId: 'm-admin', active: false })).rejects.toThrow(
        CannotDisableSelfError,
      );
    });

    it('an admin cannot disable the Owner', async () => {
      await s.actAs('m-admin');

      await expect(setStatus.execute({ membershipId: 'm-owner', active: false })).rejects.toThrow(
        CannotGrantPermissionError,
      );
    });

    it('an Owner can disable another Owner (they remain as the active Owner)', async () => {
      await s.addMember('owner2', 'owner');
      await s.actAs('m-owner');

      await setStatus.execute({ membershipId: 'm-owner2', active: false });

      expect((await s.memberships.findById('m-owner2'))?.isActive).toBe(false);
      expect(await s.memberships.countActiveWithRole('tenant-1', roleId('owner'))).toBe(1);
    });

    it('re-enables a disabled member without touching sessions', async () => {
      await s.addMember('former', 'agent', { disabled: true });
      await s.actAs('m-admin');

      await setStatus.execute({ membershipId: 'm-former', active: true });

      expect((await s.memberships.findById('m-former'))?.isActive).toBe(true);
      expect(s.identity.revokedMemberships).toEqual([]);
    });
  });
});
