import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { CannotDisableSelfError } from '../../../domain/errors/cannot-disable-self.error';
import { assertCanGrant } from '../../account-access';
import { CurrentAccess } from '../../current-access';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../ports/invitation.repository';
import { TenantEntitlements } from '../../tenant-entitlements';
import { ACCESS_CACHE, type AccessCache } from '../../ports/access-cache';
import { IDENTITY_GATEWAY, type IdentityGateway } from '../../ports/identity.gateway';
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from '../../ports/membership.repository';
import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import { ensureAnotherOwnerRemains, loadMember } from './member-guards';

/**
 * Desativa ou reativa o acesso de um membro à conta. Desativar tem efeito
 * imediato: cache de acesso invalidado e sessões dele nesta conta derrubadas.
 * O usuário continua existindo (e com acesso a outras contas, se tiver).
 */
@Injectable()
export class SetMemberStatusUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(ACCESS_CACHE) private readonly cache: AccessCache,
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    private readonly entitlements: TenantEntitlements,
  ) {}

  async execute(input: { membershipId: string; active: boolean }): Promise<void> {
    const access = await this.currentAccess.get();
    if (!input.active && input.membershipId === access.membershipId) {
      throw new CannotDisableSelfError();
    }

    await this.unitOfWork.run(async () => {
      const { membership, role } = await loadMember(
        { memberships: this.memberships, roles: this.roles },
        access.tenantId,
        input.membershipId,
      );
      assertCanGrant(access, role.permissions);

      if (input.active) {
        // Voltar ocupa um lugar no plano (o que já está ativo não conta de novo).
        if (!membership.isActive) {
          const used =
            (await this.memberships.countActiveMembers(access.tenantId)) +
            (await this.invitations.countPending(access.tenantId));
          await this.entitlements.roomFor(access.tenantId, 'members', used);
        }
        membership.enable();
      } else {
        await ensureAnotherOwnerRemains(this.memberships, membership, role);
        membership.disable();
      }
      await this.memberships.save(membership);
    });

    await this.cache.invalidate([input.membershipId]);
    if (!input.active) await this.identity.revokeMembershipSessions(input.membershipId);
  }
}
