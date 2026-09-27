import { AlreadyMemberError } from '../../../domain/errors/already-member.error';
import { CannotGrantPermissionError } from '../../../domain/errors/cannot-grant-permission.error';
import { InvitationNotFoundError } from '../../../domain/errors/invitation-not-found.error';
import {
  accountScenario,
  roleId,
  TENANT_ID,
  type AccountScenario,
} from '../../../testing/scenario';
import { AcceptInvitationUseCase, LookUpInvitationUseCase } from './accept-invitation.use-case';
import { InviteMemberUseCase } from './invite-member.use-case';
import { ListInvitationsUseCase, RevokeInvitationUseCase } from './manage-invitations.use-case';

describe('Invitations', () => {
  let s: AccountScenario;
  let invite: InviteMemberUseCase;
  let lookUp: LookUpInvitationUseCase;
  let accept: AcceptInvitationUseCase;

  beforeEach(async () => {
    s = await accountScenario();
    invite = new InviteMemberUseCase(
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
    lookUp = new LookUpInvitationUseCase(s.invitations, s.tokens, s.tenants, s.roles, s.identity);
    accept = new AcceptInvitationUseCase(
      s.invitations,
      s.tokens,
      s.tenants,
      s.roles,
      s.memberships,
      s.identity,
      s.cache,
      s.ids,
      s.unitOfWork,
    );
    await s.addMember('admin', 'admin');
    await s.actAs('m-admin');
  });

  const inviteAgent = (email = 'nova@empresa.com') =>
    invite.execute({ email, roleId: roleId('agent') });
  const tokenOf = (url: string) => url.split('/invite/')[1];

  describe('inviting', () => {
    it('returns a shareable link and stores only the token hash', async () => {
      const { invitation, inviteUrl } = await inviteAgent();

      expect(inviteUrl).toBe('https://app.test/invite/invite-token-1');
      expect(invitation.tokenHash).toBe('hash(invite-token-1)');
      expect(invitation.invitedByMembershipId).toBe('m-admin');
    });

    it('re-inviting the same email replaces the previous invitation', async () => {
      const first = await inviteAgent();
      await inviteAgent('NOVA@empresa.com');

      await expect(lookUp.execute(tokenOf(first.inviteUrl))).rejects.toThrow(
        InvitationNotFoundError,
      );
      const pending = await new ListInvitationsUseCase(s.currentAccess, s.invitations).execute();
      expect(pending).toHaveLength(1);
    });

    it('rejects inviting someone who is already an active member', async () => {
      await s.addMember('agent', 'agent');

      await expect(inviteAgent('agent@loja.com')).rejects.toThrow(AlreadyMemberError);
    });

    it('does not let an admin invite someone as Owner', async () => {
      await expect(
        invite.execute({ email: 'x@empresa.com', roleId: roleId('owner') }),
      ).rejects.toThrow(CannotGrantPermissionError);
    });

    it('a revoked invitation no longer works', async () => {
      const { invitation, inviteUrl } = await inviteAgent();

      await new RevokeInvitationUseCase(s.currentAccess, s.invitations).execute(invitation.id);

      await expect(lookUp.execute(tokenOf(inviteUrl))).rejects.toThrow(InvitationNotFoundError);
    });
  });

  describe('accepting', () => {
    it('someone without an account signs up and joins with the invited role', async () => {
      const { inviteUrl } = await inviteAgent();
      expect((await lookUp.execute(tokenOf(inviteUrl))).requiresSignup).toBe(true);

      const { tenant } = await accept.execute({
        token: tokenOf(inviteUrl),
        name: 'Nova',
        password: 'super-secret',
      });

      const user = await s.identity.findUserByEmail('nova@empresa.com');
      const membership = await s.memberships.findByUser(TENANT_ID, user!.id);
      expect(tenant.id).toBe(TENANT_ID);
      expect(membership?.roleId).toBe(roleId('agent'));
      expect(membership?.isActive).toBe(true);
      expect(s.identity.sessions.at(-1)).toMatchObject({ tenantId: TENANT_ID, userId: user!.id });
    });

    it('someone with an account joins by confirming their own password', async () => {
      await s.identity.registerUser({
        email: 'nova@empresa.com',
        name: 'Nova',
        password: 'my-password',
      });
      const { inviteUrl } = await inviteAgent();
      expect((await lookUp.execute(tokenOf(inviteUrl))).requiresSignup).toBe(false);

      await accept.execute({ token: tokenOf(inviteUrl), password: 'my-password' });

      expect(s.memberships.memberships).toHaveLength(2);
    });

    it('a wrong password does not join the account', async () => {
      await s.identity.registerUser({
        email: 'nova@empresa.com',
        name: 'Nova',
        password: 'my-password',
      });
      const { inviteUrl } = await inviteAgent();

      await expect(
        accept.execute({ token: tokenOf(inviteUrl), password: 'wrong-password' }),
      ).rejects.toThrow('invalid');
      expect(s.memberships.memberships).toHaveLength(1);
    });

    it('an invitation works only once', async () => {
      const { inviteUrl } = await inviteAgent();
      const input = { token: tokenOf(inviteUrl), name: 'Nova', password: 'super-secret' };
      await accept.execute(input);

      await expect(accept.execute(input)).rejects.toThrow(InvitationNotFoundError);
    });

    it('brings back someone who had been disabled, with the new role', async () => {
      await s.addMember('former', 'supervisor', { disabled: true });
      const { inviteUrl } = await inviteAgent('former@loja.com');

      await accept.execute({ token: tokenOf(inviteUrl), password: 'super-secret' });

      const membership = await s.memberships.findById('m-former');
      expect(membership?.isActive).toBe(true);
      expect(membership?.roleId).toBe(roleId('agent'));
      expect(s.cache.invalidated).toContain('m-former');
    });

    it('an unknown token is "not found"', async () => {
      await expect(lookUp.execute('made-up')).rejects.toThrow(InvitationNotFoundError);
    });
  });
});
