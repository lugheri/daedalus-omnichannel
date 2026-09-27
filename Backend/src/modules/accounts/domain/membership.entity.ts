import { AggregateRoot } from '../../../shared/domain/aggregate-root';

export type MembershipStatus = 'invited' | 'active' | 'disabled';

export interface MembershipProps {
  tenantId: string;
  userId: string;
  roleId: string;
  status: MembershipStatus;
  createdAt: Date;
}

/**
 * O vínculo de uma pessoa (User, do módulo identity) com um tenant.
 * Guarda só o `userId` — sem relação de banco com outro módulo.
 */
export class Membership extends AggregateRoot<MembershipProps> {
  /** Vínculo de quem cria a conta ou aceita um convite: já nasce ativo. */
  static createActive(id: string, input: { tenantId: string; userId: string; roleId: string }) {
    return new Membership(id, { ...input, status: 'active', createdAt: new Date() });
  }

  static restore(id: string, props: MembershipProps): Membership {
    return new Membership(id, props);
  }

  changeRole(roleId: string): void {
    this.props.roleId = roleId;
  }

  disable(): void {
    this.props.status = 'disabled';
  }

  /** Reativa, opcionalmente já com outro cargo (ex.: novo convite para quem saiu). */
  enable(roleId?: string): void {
    this.props.status = 'active';
    if (roleId) this.props.roleId = roleId;
  }

  get isActive(): boolean {
    return this.props.status === 'active';
  }

  get tenantId() {
    return this.props.tenantId;
  }

  get userId() {
    return this.props.userId;
  }

  get roleId() {
    return this.props.roleId;
  }

  get status() {
    return this.props.status;
  }

  get createdAt() {
    return this.props.createdAt;
  }
}
