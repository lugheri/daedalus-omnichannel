import type { Tenant } from '../domain/tenant.entity';

export const TenantPresenter = {
  toHttp(tenant: Tenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug.value,
      status: tenant.status,
      /** Revendedor (ou a raiz): pode criar contas abaixo. */
      canCreateChildren: tenant.canCreateChildren,
      /** A conta da plataforma (mantém os modelos de site, por exemplo). */
      isRoot: tenant.isRoot,
    };
  },
};
