import { AggregateRoot } from '../../../shared/domain/aggregate-root';

export interface SessionProps {
  userId: string;
  tenantId: string;
  membershipId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastRotatedAt: Date | null;
  revokedAt: Date | null;
}

export interface StartSessionProps {
  userId: string;
  tenantId: string;
  membershipId: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export type RotationResult = 'rotated' | 'inactive' | 'reuse-detected';

/**
 * Uma sessão de login, válida para UM tenant (ADR 0004).
 *
 * Rotação: cada refresh troca o segredo. Se chegar um segredo que não é o
 * atual, alguém está usando um token antigo — o legítimo já o trocou, então
 * um dos dois é um atacante. Sem saber qual, a sessão inteira é revogada.
 */
export class Session extends AggregateRoot<SessionProps> {
  static start(id: string, input: StartSessionProps): Session {
    return new Session(id, {
      ...input,
      createdAt: new Date(),
      lastRotatedAt: null,
      revokedAt: null,
    });
  }

  static restore(id: string, props: SessionProps): Session {
    return new Session(id, props);
  }

  isActive(now: Date): boolean {
    return this.props.revokedAt === null && this.props.expiresAt > now;
  }

  rotate(
    presentedHash: string,
    next: { refreshTokenHash: string; expiresAt: Date },
    now: Date,
  ): RotationResult {
    if (!this.isActive(now)) return 'inactive';

    if (presentedHash !== this.props.refreshTokenHash) {
      this.revoke(now);
      return 'reuse-detected';
    }

    this.props.refreshTokenHash = next.refreshTokenHash;
    this.props.expiresAt = next.expiresAt;
    this.props.lastRotatedAt = now;
    return 'rotated';
  }

  revoke(now: Date): void {
    this.props.revokedAt ??= now;
  }

  get userId() {
    return this.props.userId;
  }

  get tenantId() {
    return this.props.tenantId;
  }

  get membershipId() {
    return this.props.membershipId;
  }

  get refreshTokenHash() {
    return this.props.refreshTokenHash;
  }

  get expiresAt() {
    return this.props.expiresAt;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get lastRotatedAt() {
    return this.props.lastRotatedAt;
  }

  get revokedAt() {
    return this.props.revokedAt;
  }
}
