import type { Slug } from '../../domain/slug.vo';
import type { Tenant } from '../../domain/tenant.entity';

export interface TenantRepository {
  save(tenant: Tenant): Promise<void>;
  findById(id: string): Promise<Tenant | null>;
  findManyByIds(ids: string[]): Promise<Tenant[]>;
  existsBySlug(slug: Slug): Promise<boolean>;
  findBySlug(slug: string): Promise<Tenant | null>;
  /** A conta da plataforma (mãe dos cadastros públicos), se já foi definida. */
  findRoot(): Promise<Tenant | null>;
  /** Se existe ao menos uma conta (o cadastro só cria a primeira antes da raiz). */
  existsAny(): Promise<boolean>;
  /** Quantas contas estão diretamente abaixo desta (o limite do plano do revendedor). */
  countChildren(tenantId: string): Promise<number>;
  /** Todas as contas abaixo desta (filhas, netas...), por nome. */
  listDescendants(tenantId: string): Promise<Tenant[]>;
  /**
   * Põe debaixo da raiz toda conta que ainda não tem mãe (e atualiza os
   * ancestrais das contas abaixo delas). Devolve quantas foram adotadas.
   */
  adoptOrphans(root: Tenant): Promise<number>;
}

export const TENANT_REPOSITORY = Symbol('TenantRepository');
