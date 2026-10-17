/** O que o site mostra e vem de outros módulos (via facades, no tenant atual). */

export interface SiteServiceItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  durationMinutes: number;
}

export interface SiteProfessionalItem {
  name: string;
  title: string | null;
  bio: string | null;
}

export interface SiteFormInfo {
  /** Endereço do `<form action>` (API pública, pela chave do formulário). */
  actionUrl: string;
  kind: 'contact' | 'service';
}

export interface SiteSources {
  /** Serviços ativos marcados "mostrar no site". */
  services(): Promise<SiteServiceItem[]>;
  /** Profissionais ativos marcados "mostrar no site". */
  professionals(): Promise<SiteProfessionalItem[]>;
  /** Formulário ativo da conta, ou null. */
  form(id: string): Promise<SiteFormInfo | null>;
}

export const SITE_SOURCES = Symbol('SiteSources');

/** A conta atual, como o site a enxerga. */
export interface SiteAccount {
  current(): Promise<{ name: string; slug: string; isRoot: boolean }>;
}

export const SITE_ACCOUNT = Symbol('SiteAccount');
