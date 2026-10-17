import type { IdGenerator } from '../../../shared/application/id-generator';
import { Slug } from '../domain/slug.vo';
import type { TenantRepository } from './ports/tenant.repository';

const MAX_SLUG_ATTEMPTS = 5;

/** Slug livre a partir do nome da conta ("loja-x", senão "loja-x-a1b2c3"). */
export async function uniqueSlugFor(
  tenants: TenantRepository,
  ids: IdGenerator,
  name: string,
): Promise<Slug> {
  const base = Slug.fromName(name);
  let candidate = base;
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    if (!(await tenants.existsBySlug(candidate))) return candidate;
    // O fim de um UUIDv7 é aleatório: serve de sufixo curto e sem colisão prática.
    candidate = base.withSuffix(ids.generate().replace(/-/g, '').slice(-6));
  }
  throw new Error(`Could not find a free slug for "${name}"`);
}
