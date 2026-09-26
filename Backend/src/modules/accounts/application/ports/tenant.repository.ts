import type { Slug } from '../../domain/slug.vo';
import type { Tenant } from '../../domain/tenant.entity';

export interface TenantRepository {
  save(tenant: Tenant): Promise<void>;
  findManyByIds(ids: string[]): Promise<Tenant[]>;
  existsBySlug(slug: Slug): Promise<boolean>;
}

export const TENANT_REPOSITORY = Symbol('TenantRepository');
