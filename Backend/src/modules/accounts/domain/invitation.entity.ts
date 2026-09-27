import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidInvitationEmailError } from './errors/invalid-invitation-email.error';
import { InvitationNotFoundError } from './errors/invitation-not-found.error';

export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface InvitationProps {
  tenantId: string;
  email: string;
  roleId: string;
  /** Só o hash do token fica guardado — como no refresh token. */
  tokenHash: string;
  invitedByMembershipId: string;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALIDITY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Convite para entrar numa conta, com um cargo definido. Quem tem o token
 * (link) aceita; vale por 7 dias e uma única vez.
 */
export class Invitation extends AggregateRoot<InvitationProps> {
  static create(
    id: string,
    input: {
      tenantId: string;
      email: string;
      roleId: string;
      tokenHash: string;
      invitedBy: string;
    },
  ): Invitation {
    const email = input.email.trim().toLowerCase();
    if (email.length > 320 || !EMAIL.test(email)) throw new InvalidInvitationEmailError();

    const now = new Date();
    return new Invitation(id, {
      tenantId: input.tenantId,
      email,
      roleId: input.roleId,
      tokenHash: input.tokenHash,
      invitedByMembershipId: input.invitedBy,
      status: 'pending',
      expiresAt: new Date(now.getTime() + VALIDITY_DAYS * DAY_MS),
      createdAt: now,
      acceptedAt: null,
    });
  }

  static restore(id: string, props: InvitationProps): Invitation {
    return new Invitation(id, props);
  }

  isUsableAt(now: Date): boolean {
    return this.props.status === 'pending' && this.props.expiresAt > now;
  }

  /** Expirado, revogado ou já usado: para quem tem o link, é tudo "não encontrado". */
  accept(now: Date): void {
    if (!this.isUsableAt(now)) throw new InvitationNotFoundError();
    this.props.status = 'accepted';
    this.props.acceptedAt = now;
  }

  revoke(): void {
    if (this.props.status === 'pending') this.props.status = 'revoked';
  }

  get tenantId() {
    return this.props.tenantId;
  }

  get email() {
    return this.props.email;
  }

  get roleId() {
    return this.props.roleId;
  }

  get tokenHash() {
    return this.props.tokenHash;
  }

  get invitedByMembershipId() {
    return this.props.invitedByMembershipId;
  }

  get status() {
    return this.props.status;
  }

  get expiresAt() {
    return this.props.expiresAt;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get acceptedAt() {
    return this.props.acceptedAt;
  }
}
