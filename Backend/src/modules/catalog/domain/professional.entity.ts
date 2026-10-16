import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { defined } from './defined';
import { InvalidCatalogItemError } from './errors/invalid-catalog-item.error';

export interface ProfessionalDetails {
  name: string;
  /** Função mostrada no site e na agenda ("Cabeleireira", "Dentista"). */
  title: string | null;
  bio: string | null;
  /**
   * Membro da conta que é este profissional, se tiver login. Não é obrigatório:
   * quem só atende (sem usar o sistema) é só um cadastro.
   */
  membershipId: string | null;
  showOnSite: boolean;
}

export interface ProfessionalProps extends ProfessionalDetails {
  tenantId: string;
  /** Serviços que faz (ids de Offering da mesma conta). */
  offeringIds: string[];
  active: boolean;
  createdAt: Date;
}

/**
 * Quem atende. Os serviços que faz e o membro vinculado são conferidos pelo
 * use case (existem na conta? o membro está ativo?).
 */
export class Professional extends AggregateRoot<ProfessionalProps> {
  static create(
    id: string,
    input: ProfessionalDetails & { tenantId: string; offeringIds: string[] },
  ): Professional {
    return new Professional(id, {
      ...validDetails(input),
      tenantId: input.tenantId,
      offeringIds: unique(input.offeringIds),
      active: true,
      createdAt: new Date(),
    });
  }

  static restore(id: string, props: ProfessionalProps): Professional {
    return new Professional(id, props);
  }

  update(
    changes: Partial<ProfessionalDetails> & { offeringIds?: string[]; active?: boolean },
  ): void {
    const { offeringIds, active, ...details } = changes;
    Object.assign(this.props, validDetails({ ...this.details, ...defined(details) }));
    if (offeringIds !== undefined) this.props.offeringIds = unique(offeringIds);
    if (active !== undefined) this.props.active = active;
  }

  /** O serviço foi excluído: sai da lista (o banco faz o mesmo em cascata). */
  dropOffering(offeringId: string): void {
    this.props.offeringIds = this.props.offeringIds.filter((id) => id !== offeringId);
  }

  private get details(): ProfessionalDetails {
    const { name, title, bio, membershipId, showOnSite } = this.props;
    return { name, title, bio, membershipId, showOnSite };
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get name() {
    return this.props.name;
  }
  get title() {
    return this.props.title;
  }
  get bio() {
    return this.props.bio;
  }
  get membershipId() {
    return this.props.membershipId;
  }
  get offeringIds(): readonly string[] {
    return this.props.offeringIds;
  }
  get showOnSite() {
    return this.props.showOnSite;
  }
  get active() {
    return this.props.active;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}

function validDetails(input: ProfessionalDetails): ProfessionalDetails {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new InvalidCatalogItemError('PROFESSIONAL_INVALID_NAME');
  }
  const title = input.title?.trim() || null;
  if (title && title.length > 60) throw new InvalidCatalogItemError('PROFESSIONAL_INVALID_TITLE');
  const bio = input.bio?.trim() || null;
  if (bio && bio.length > 1000) throw new InvalidCatalogItemError('PROFESSIONAL_INVALID_BIO');

  return { name, title, bio, membershipId: input.membershipId, showOnSite: input.showOnSite };
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}
