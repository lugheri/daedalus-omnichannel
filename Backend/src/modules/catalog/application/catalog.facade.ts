import { Inject, Injectable } from '@nestjs/common';
import { OFFERING_REPOSITORY, type OfferingRepository } from './ports/offering.repository';
import {
  PROFESSIONAL_REPOSITORY,
  type ProfessionalRepository,
} from './ports/professional.repository';

export interface SiteServiceSummary {
  id: string;
  name: string;
  priceCents: number | null;
}

/** Serviço como aparece no site. */
export interface SiteOffering extends SiteServiceSummary {
  description: string | null;
  durationMinutes: number;
}

/** Profissional como aparece no site (sem o vínculo com o login). */
export interface SiteProfessional {
  name: string;
  title: string | null;
  bio: string | null;
}

/** API do catálogo para outros módulos (formulários do site, agenda). */
@Injectable()
export class CatalogFacade {
  constructor(
    @Inject(OFFERING_REPOSITORY) private readonly offerings: OfferingRepository,
    @Inject(PROFESSIONAL_REPOSITORY) private readonly professionals: ProfessionalRepository,
  ) {}

  /** Serviço que pode ser pedido pelo site: ativo e marcado para aparecer lá. */
  async siteService(id: string): Promise<SiteServiceSummary | null> {
    const offering = await this.offerings.findById(id);
    if (!offering?.active || !offering.showOnSite) return null;
    return { id: offering.id, name: offering.name, priceCents: offering.priceCents };
  }

  /** Serviços ativos marcados "mostrar no site", por nome. */
  async siteOfferings(): Promise<SiteOffering[]> {
    return (await this.offerings.list())
      .filter((o) => o.active && o.showOnSite)
      .map((o) => ({
        id: o.id,
        name: o.name,
        description: o.description,
        priceCents: o.priceCents,
        durationMinutes: o.durationMinutes,
      }));
  }

  /** Profissionais ativos marcados "mostrar no site", por nome. */
  async siteProfessionals(): Promise<SiteProfessional[]> {
    return (await this.professionals.list())
      .filter((p) => p.active && p.showOnSite)
      .map((p) => ({ name: p.name, title: p.title, bio: p.bio }));
  }
}
