import type { Invitation } from '../../domain/invitation.entity';

export interface InvitationRepository {
  save(invitation: Invitation): Promise<void>;
  /** Pelo hash do token do link — é assim que o convidado o localiza. */
  findByTokenHash(tokenHash: string): Promise<Invitation | null>;
  findInTenant(tenantId: string, id: string): Promise<Invitation | null>;
  findPendingByEmail(tenantId: string, email: string): Promise<Invitation | null>;
  listPending(tenantId: string): Promise<Invitation[]>;
  countPendingWithRole(tenantId: string, roleId: string): Promise<number>;
}

export const INVITATION_REPOSITORY = Symbol('InvitationRepository');
