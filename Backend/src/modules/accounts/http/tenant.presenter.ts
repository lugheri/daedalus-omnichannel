import type { Tenant } from '../domain/tenant.entity';

export const TenantPresenter = {
  toHttp(tenant: Tenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug.value,
      status: tenant.status,
    };
  },
};
