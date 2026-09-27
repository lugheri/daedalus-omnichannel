import { Inject, Injectable } from '@nestjs/common';
import { InvitationNotFoundError } from '../../../domain/errors/invitation-not-found.error';
import type { Invitation } from '../../../domain/invitation.entity';
import { CurrentAccess } from '../../current-access';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../ports/invitation.repository';

@Injectable()
export class ListInvitationsUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
  ) {}

  /** Só os convites ainda utilizáveis (pendentes e dentro da validade). */
  async execute(): Promise<Invitation[]> {
    const { tenantId } = await this.currentAccess.get();
    const now = new Date();
    return (await this.invitations.listPending(tenantId)).filter((i) => i.isUsableAt(now));
  }
}

@Injectable()
export class RevokeInvitationUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
  ) {}

  async execute(invitationId: string): Promise<void> {
    const { tenantId } = await this.currentAccess.get();
    const invitation = await this.invitations.findInTenant(tenantId, invitationId);
    if (!invitation) throw new InvitationNotFoundError();

    invitation.revoke();
    await this.invitations.save(invitation);
  }
}
