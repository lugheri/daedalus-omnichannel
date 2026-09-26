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
}

/** A conta/empresa cliente (ADR 0002). Toda conta nova começa em trial. */
export class Tenant extends AggregateRoot<TenantProps> {
  static create(id: string, input: { name: string; slug: Slug }): Tenant {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 100) throw new InvalidTenantNameError();

    const tenant = new Tenant(id, {
      name,
      slug: input.slug,
      status: 'trial',
      createdAt: new Date(),
    });
    tenant.addEvent(new TenantCreatedEvent(id, name));
    return tenant;
  }

  static restore(id: string, props: TenantProps): Tenant {
    return new Tenant(id, props);
  }

  /** Conta suspensa não permite login de nenhum membro. */
  get allowsAccess(): boolean {
    return this.props.status !== 'suspended';
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
}
