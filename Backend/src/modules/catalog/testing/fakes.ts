import type { TenantContext } from '../../../shared/application/tenant-context';
import type { MemberDirectory } from '../application/ports/member-directory';
import type { OfferingRepository } from '../application/ports/offering.repository';
import type { ProfessionalRepository } from '../application/ports/professional.repository';
import { CatalogConflictError } from '../domain/errors/catalog-conflict.error';
import type { Offering } from '../domain/offering.entity';
import type { Professional } from '../domain/professional.entity';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR');

/** Reproduz o repositório real: isolado por tenant, nome único, ordem por nome. */
export class InMemoryOfferingRepository implements OfferingRepository {
  private items: Offering[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((o) => o.tenantId === this.tenant.tenantId);
  }

  save(offering: Offering): Promise<void> {
    if (this.ofTenant().some((o) => o.id !== offering.id && o.name === offering.name)) {
      return Promise.reject(new CatalogConflictError('SERVICE_NAME_TAKEN'));
    }
    this.items = [...this.items.filter((o) => o.id !== offering.id), offering];
    return Promise.resolve();
  }

  findById(id: string): Promise<Offering | null> {
    return Promise.resolve(this.ofTenant().find((o) => o.id === id) ?? null);
  }

  findByIds(ids: string[]): Promise<Offering[]> {
    return Promise.resolve(this.ofTenant().filter((o) => ids.includes(o.id)));
  }

  list(): Promise<Offering[]> {
    return Promise.resolve(this.ofTenant().sort(byName));
  }

  delete(offering: Offering): Promise<void> {
    this.items = this.items.filter((o) => o.id !== offering.id);
    return Promise.resolve();
  }
}

/** Isolado por tenant; um membro vinculado a no máximo um profissional. */
export class InMemoryProfessionalRepository implements ProfessionalRepository {
  private items: Professional[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((p) => p.tenantId === this.tenant.tenantId);
  }

  save(professional: Professional): Promise<void> {
    const taken =
      professional.membershipId !== null &&
      this.ofTenant().some(
        (p) => p.id !== professional.id && p.membershipId === professional.membershipId,
      );
    if (taken) return Promise.reject(new CatalogConflictError('PROFESSIONAL_MEMBER_TAKEN'));
    this.items = [...this.items.filter((p) => p.id !== professional.id), professional];
    return Promise.resolve();
  }

  findById(id: string): Promise<Professional | null> {
    return Promise.resolve(this.ofTenant().find((p) => p.id === id) ?? null);
  }

  list(): Promise<Professional[]> {
    return Promise.resolve(this.ofTenant().sort(byName));
  }

  listByOffering(offeringId: string): Promise<Professional[]> {
    return Promise.resolve(this.ofTenant().filter((p) => p.offeringIds.includes(offeringId)));
  }

  delete(professional: Professional): Promise<void> {
    this.items = this.items.filter((p) => p.id !== professional.id);
    return Promise.resolve();
  }
}

export class FakeMemberDirectory implements MemberDirectory {
  constructor(private readonly active: string[]) {}

  activeMemberIds(ids: string[]): Promise<string[]> {
    return Promise.resolve(ids.filter((id) => this.active.includes(id)));
  }
}
