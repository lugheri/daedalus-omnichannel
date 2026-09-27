import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { AlreadyMemberError } from '../../../domain/errors/already-member.error';
import { RoleNotFoundError } from '../../../domain/errors/role-not-found.error';
import { Invitation } from '../../../domain/invitation.entity';
import { assertCanGrant } from '../../account-access';
import { CurrentAccess } from '../../current-access';
import { ACCOUNTS_SETTINGS, type AccountsSettings } from '../../ports/accounts-settings';
import { IDENTITY_GATEWAY, type IdentityGateway } from '../../ports/identity.gateway';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../ports/invitation.repository';
import {
  INVITATION_TOKEN_GENERATOR,
  type InvitationTokenGenerator,
} from '../../ports/invitation-token-generator';
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from '../../ports/membership.repository';
import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';

export interface InviteMemberResult {
  invitation: Invitation;
  /** Link para enviar ao convidado. É a única vez que o token aparece em claro. */
  inviteUrl: string;
}

/**
 * Convida um e-mail para a conta, com um cargo. Enquanto não houver envio de
 * e-mail, quem convida recebe o link e o repassa (como "copiar link de
 * convite"). Convidar de novo o mesmo e-mail substitui o convite anterior.
 */
@Injectable()
export class InviteMemberUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(INVITATION_TOKEN_GENERATOR) private readonly tokens: InvitationTokenGenerator,
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
    @Inject(ACCOUNTS_SETTINGS) private readonly settings: AccountsSettings,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: { email: string; roleId: string }): Promise<InviteMemberResult> {
    const access = await this.currentAccess.get();
    const { token, hash } = this.tokens.generate();

    const invitation = await this.unitOfWork.run(async () => {
      const role = await this.roles.findInTenant(access.tenantId, input.roleId);
      if (!role) throw new RoleNotFoundError();
      assertCanGrant(access, role.permissions);

      const invitation = Invitation.create(this.ids.generate(), {
        tenantId: access.tenantId,
        email: input.email,
        roleId: role.id,
        tokenHash: hash,
        invitedBy: access.membershipId,
      });

      const user = await this.identity.findUserByEmail(invitation.email);
      const membership = user && (await this.memberships.findByUser(access.tenantId, user.id));
      if (membership?.isActive) throw new AlreadyMemberError();

      const previous = await this.invitations.findPendingByEmail(access.tenantId, invitation.email);
      if (previous) {
        previous.revoke();
        await this.invitations.save(previous);
      }

      await this.invitations.save(invitation);
      return invitation;
    });

    return { invitation, inviteUrl: `${this.settings.appUrl}/invite/${token}` };
  }
}
