import { CannotGrantPermissionError } from '../../../domain/errors/cannot-grant-permission.error';
import { RoleInUseError } from '../../../domain/errors/role-in-use.error';
import { SystemRoleImmutableError } from '../../../domain/errors/system-role-immutable.error';
import { Role } from '../../../domain/role.entity';
import {
  accountScenario,
  roleId,
  TENANT_ID,
  type AccountScenario,
} from '../../../testing/scenario';
import { InviteMemberUseCase } from '../invitations/invite-member.use-case';
import { CreateRoleUseCase, DeleteRoleUseCase, UpdateRoleUseCase } from './manage-roles.use-case';

describe('Role management', () => {
  let s: AccountScenario;
  let create: CreateRoleUseCase;
  let update: UpdateRoleUseCase;
  let remove: DeleteRoleUseCase;

  beforeEach(async () => {
    s = await accountScenario();
    create = new CreateRoleUseCase(s.currentAccess, s.roles, s.ids);
    update = new UpdateRoleUseCase(s.currentAccess, s.roles, s.memberships, s.cache);
    remove = new DeleteRoleUseCase(
      s.currentAccess,
      s.roles,
      s.memberships,
      s.invitations,
      s.unitOfWork,
    );
    await s.addMember('owner', 'owner');
    await s.addMember('admin', 'admin');
  });

  it('creates a custom role', async () => {
    await s.actAs('m-admin');

    const role = await create.execute({ name: 'Financeiro', permissions: ['reports:view'] });

    expect(role.tenantId).toBe(TENANT_ID);
    expect(role.isSystem).toBe(false);
  });

  it('nobody grants a permission they do not have', async () => {
    // Um "gerente de cargos" que só vê contatos não pode criar cargo que gere membros.
    await s.roles.save(
      Role.createCustom('role-limited', {
        tenantId: TENANT_ID,
        name: 'Gerente de cargos',
        permissions: ['roles:manage', 'contacts:view'],
      }),
    );
    const limited = await s.addMember('limited', 'agent');
    limited.changeRole('role-limited');
    await s.memberships.save(limited);
    await s.actAs('m-limited');

    await expect(
      create.execute({ name: 'Poderoso', permissions: ['members:manage'] }),
    ).rejects.toThrow(CannotGrantPermissionError);
  });

  it('editing a role takes effect at once for everyone who has it', async () => {
    await s.addMember('agent1', 'agent');
    await s.addMember('agent2', 'agent');
    await s.actAs('m-admin');

    await update.execute({ roleId: roleId('agent'), permissions: ['contacts:view'] });

    expect(s.cache.invalidated).toEqual(expect.arrayContaining(['m-agent1', 'm-agent2']));
  });

  it('the Owner role cannot be edited, even by an Owner', async () => {
    await s.actAs('m-owner');

    await expect(update.execute({ roleId: roleId('owner'), name: 'Chefe' })).rejects.toThrow(
      SystemRoleImmutableError,
    );
  });

  it('a role in use by members cannot be deleted', async () => {
    await s.actAs('m-owner');

    await expect(remove.execute(roleId('admin'))).rejects.toThrow(RoleInUseError);
  });

  it('a role waiting on a pending invitation cannot be deleted', async () => {
    await s.actAs('m-owner');
    const invite = new InviteMemberUseCase(
      s.currentAccess,
      s.roles,
      s.memberships,
      s.invitations,
      s.tokens,
      s.identity,
      s.settings,
      s.ids,
      s.unitOfWork,
    );
    await invite.execute({ email: 'x@empresa.com', roleId: roleId('supervisor') });

    await expect(remove.execute(roleId('supervisor'))).rejects.toThrow(RoleInUseError);
  });

  it('deletes an unused role', async () => {
    await s.actAs('m-owner');

    await remove.execute(roleId('supervisor'));

    expect(await s.roles.findById(roleId('supervisor'))).toBeNull();
  });
});
