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

/** Serviço como a agenda o usa (inclusive os inativos, para o histórico). */
export interface AgendaOffering {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number | null;
  showOnSite: boolean;
  active: boolean;
}

/** Profissional como a agenda o usa: quais serviços faz. */
export interface AgendaProfessional {
  id: string;
  name: string;
  offeringIds: string[];
  showOnSite: boolean;
  active: boolean;
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

  /** Serviços e profissionais da conta, por nome (a agenda filtra o que precisar). */
  async agendaCatalog(): Promise<{
    offerings: AgendaOffering[];
    professionals: AgendaProfessional[];
  }> {
    const [offerings, professionals] = await Promise.all([
      this.offerings.list(),
      this.professionals.list(),
    ]);
    return {
      offerings: offerings.map((o) => ({
        id: o.id,
        name: o.name,
        durationMinutes: o.durationMinutes,
        priceCents: o.priceCents,
        showOnSite: o.showOnSite,
        active: o.active,
      })),
      professionals: professionals.map((p) => ({
        id: p.id,
        name: p.name,
        offeringIds: [...p.offeringIds],
        showOnSite: p.showOnSite,
        active: p.active,
      })),
    };
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
