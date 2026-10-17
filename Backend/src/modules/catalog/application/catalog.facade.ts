import { Inject, Injectable } from '@nestjs/common';
import { OFFERING_REPOSITORY, type OfferingRepository } from './ports/offering.repository';

export interface SiteServiceSummary {
  id: string;
  name: string;
  priceCents: number | null;
}

/** API do catálogo para outros módulos (formulários do site, agenda). */
@Injectable()
export class CatalogFacade {
  constructor(@Inject(OFFERING_REPOSITORY) private readonly offerings: OfferingRepository) {}

  /** Serviço que pode ser pedido pelo site: ativo e marcado para aparecer lá. */
  async siteService(id: string): Promise<SiteServiceSummary | null> {
    const offering = await this.offerings.findById(id);
    if (!offering?.active || !offering.showOnSite) return null;
    return { id: offering.id, name: offering.name, priceCents: offering.priceCents };
  }
}
