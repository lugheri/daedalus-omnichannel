import { AggregateRoot } from '../../../shared/domain/aggregate-root';

export type MembershipStatus = 'invited' | 'active' | 'disabled';

export interface MembershipProps {
  tenantId: string;
  userId: string;
  roleId: string;
  status: MembershipStatus;
  createdAt: Date;
  /**
   * Vínculo DELEGADO: de quem entrou vindo de uma conta acima — o vínculo dela
   * lá (que precisa continuar valendo para este valer). Ausente = membro comum.
   */
  delegatedFromMembershipId?: string | null;
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

  /**
   * Acesso de alguém de uma conta acima (com `accounts:children`), com o
   * cargo de sistema "Acesso da conta-mãe".
   */
  static createDelegated(
    id: string,
    input: { tenantId: string; userId: string; roleId: string; fromMembershipId: string },
  ) {
    const { fromMembershipId, ...rest } = input;
    return new Membership(id, {
      ...rest,
      status: 'active',
      createdAt: new Date(),
      delegatedFromMembershipId: fromMembershipId,
    });
  }

  /** Nova entrada pela conta de cima (reativa e atualiza de qual vínculo veio). */
  redelegate(fromMembershipId: string, roleId: string): void {
    this.props.status = 'active';
    this.props.roleId = roleId;
    this.props.delegatedFromMembershipId = fromMembershipId;
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

  get isDelegated(): boolean {
    return !!this.props.delegatedFromMembershipId;
  }

  get delegatedFromMembershipId(): string | null {
    return this.props.delegatedFromMembershipId ?? null;
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
