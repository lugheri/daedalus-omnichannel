import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidTenantNameError } from './errors/invalid-tenant-name.error';
import { TenantCreatedEvent } from './events/tenant-created.event';
import type { Slug } from './slug.vo';

export type TenantStatus = 'trial' | 'active' | 'suspended';

export interface TenantProps {
  name: string;
  slug: Slug;
  status: TenantStatus;
  createdAt: Date;
  /** Conta-mãe; null/ausente = topo da árvore. */
  parentId?: string | null;
  /** Ids do topo até a mãe (vazio no topo). */
  ancestors?: string[];
  /** A conta da plataforma: mãe dos cadastros públicos. */
  isRoot?: boolean;
  /** Revendedor: pode criar contas abaixo (quem decide é a conta de cima). */
  allowsChildren?: boolean;
}

/**
 * A conta/empresa cliente (ADR 0002). Toda conta nova começa em trial.
 *
 * Contas formam uma árvore: a conta-mãe cria e gerencia as filhas, em
 * qualquer profundidade (plataforma → revendedor → cliente). Quem está numa
 * conta acima, com `accounts:children`, entra nas de baixo (ver ADR 0009).
 */
export class Tenant extends AggregateRoot<TenantProps> {
  /** `parent`: a conta-mãe (null = conta sem mãe, ex.: antes de existir a raiz). */
  static create(
    id: string,
    input: { name: string; slug: Slug; parent?: Tenant | null; allowsChildren?: boolean },
  ): Tenant {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 100) throw new InvalidTenantNameError();

    const tenant = new Tenant(id, {
      name,
      slug: input.slug,
      status: 'trial',
      createdAt: new Date(),
      parentId: input.parent?.id ?? null,
      ancestors: input.parent ? [...input.parent.ancestors, input.parent.id] : [],
      isRoot: false,
      allowsChildren: input.allowsChildren ?? false,
    });
    tenant.addEvent(new TenantCreatedEvent(id, name));
    return tenant;
  }

  static restore(id: string, props: TenantProps): Tenant {
    return new Tenant(id, props);
  }

  /** Conta suspensa não permite login de nenhum membro (nem de quem vem de cima). */
  get allowsAccess(): boolean {
    return this.props.status !== 'suspended';
  }

  suspend(): void {
    this.props.status = 'suspended';
  }

  /** Volta como ativa (o trial, se havia, não volta). */
  reactivate(): void {
    if (this.props.status === 'suspended') this.props.status = 'active';
  }

  /** Esta conta está abaixo de `tenantId` (filha, neta...)? */
  isBelow(tenantId: string): boolean {
    return this.ancestors.includes(tenantId);
  }

  /** Vira a conta da plataforma (topo). Só para contas sem mãe. */
  markRoot(): void {
    this.props.isRoot = true;
    this.props.allowsChildren = true;
  }

  /** A raiz sempre pode ter contas abaixo. */
  setAllowsChildren(allowed: boolean): void {
    if (!this.isRoot) this.props.allowsChildren = allowed;
  }

  /** Pode criar contas filhas? */
  get canCreateChildren(): boolean {
    return this.isRoot || (this.props.allowsChildren ?? false);
  }

  /** Pendura uma conta sem mãe debaixo de outra (ex.: ao definir a raiz). */
  attachTo(parent: Tenant): void {
    this.props.parentId = parent.id;
    this.props.ancestors = [...parent.ancestors, parent.id];
  }

  get name() {
    return this.props.name;
  }

  get slug() {
    return this.props.slug;
  }

  get status() {
    return this.props.status;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get parentId(): string | null {
    return this.props.parentId ?? null;
  }

  get ancestors(): readonly string[] {
    return this.props.ancestors ?? [];
  }

  get isRoot(): boolean {
    return this.props.isRoot ?? false;
  }
}
