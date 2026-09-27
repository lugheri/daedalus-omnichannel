import { DEFAULT_ROLES } from './default-roles';
import { InvalidInvitationEmailError } from './errors/invalid-invitation-email.error';
import { InvalidRoleError } from './errors/invalid-role.error';
import { InvitationNotFoundError } from './errors/invitation-not-found.error';
import { SystemRoleImmutableError } from './errors/system-role-immutable.error';
import { Invitation } from './invitation.entity';
import { Role } from './role.entity';

const template = (key: string) => DEFAULT_ROLES.find((r) => r.key === key)!;

describe('Role management', () => {
  it('creates a custom role without duplicated permissions', () => {
    const role = Role.createCustom('role-1', {
      tenantId: 't',
      name: ' Financeiro ',
      permissions: ['reports:view', 'reports:view'],
    });

    expect(role.name).toBe('Financeiro');
    expect(role.permissions).toEqual(['reports:view']);
    expect(role.key).toBeNull();
  });

  it('never lets a non-Owner role hold account:manage', () => {
    expect(() =>
      Role.createCustom('role-1', {
        tenantId: 't',
        name: 'Quase dono',
        permissions: ['account:manage'],
      }),
    ).toThrow(InvalidRoleError);
  });

  it('lets the tenant adjust default roles, but never the Owner', () => {
    const agent = Role.fromTemplate('r-agent', 't', template('agent'));
    agent.update({ permissions: ['contacts:view'] });
    expect(agent.permissions).toEqual(['contacts:view']);

    const owner = Role.fromTemplate('r-owner', 't', template('owner'));
    expect(() => owner.update({ name: 'Chefe' })).toThrow(SystemRoleImmutableError);
    expect(() => owner.assertDeletable()).toThrow(SystemRoleImmutableError);
  });
});

describe('Invitation', () => {
  const create = () =>
    Invitation.create('inv-1', {
      tenantId: 't',
      email: ' Nova@Empresa.com ',
      roleId: 'r',
      tokenHash: 'h',
      invitedBy: 'm',
    });

  it('normalizes the email and is valid for 7 days', () => {
    const invitation = create();

    expect(invitation.email).toBe('nova@empresa.com');
    expect(invitation.isUsableAt(new Date(Date.now() + 6 * 86_400_000))).toBe(true);
    expect(invitation.isUsableAt(new Date(Date.now() + 8 * 86_400_000))).toBe(false);
  });

  it('can be accepted only once', () => {
    const invitation = create();
    invitation.accept(new Date());

    expect(() => invitation.accept(new Date())).toThrow(InvitationNotFoundError);
  });

  it('cannot be accepted after being revoked or expired', () => {
    const revoked = create();
    revoked.revoke();
    expect(() => revoked.accept(new Date())).toThrow(InvitationNotFoundError);

    expect(() => create().accept(new Date(Date.now() + 8 * 86_400_000))).toThrow(
      InvitationNotFoundError,
    );
  });

  it('rejects an invalid email', () => {
    expect(() =>
      Invitation.create('i', {
        tenantId: 't',
        email: 'nope',
        roleId: 'r',
        tokenHash: 'h',
        invitedBy: 'm',
      }),
    ).toThrow(InvalidInvitationEmailError);
  });
});
