import type { LandingContent } from '../domain/landing-content';
import type { SiteContent } from '../domain/site-content';
import type { SiteFormInfo, SiteServiceItem } from './ports/site-sources';
import { buildSiteView } from './site-view';

/**
 * O que os marcadores de um modelo de LANDING enxergam (ADR 0014). Contrato
 * com quem escreve modelos, como o view do site: só acrescente campos (e
 * espelhe em `Frontend/src/features/sites/markers.ts`). Os dados da empresa
 * (`business`, `theme`, `logo`) são os mesmos do site; o resto é da variante.
 */
export interface LandingViewInput {
  /** O site da conta (empresa, cor, logo, capa padrão). */
  site: SiteContent;
  landing: LandingContent;
  /** Endereço da landing page (canônico, sem a letra da variante). */
  pageUrl: string | null;
  /** Endereço do site (o "voltar ao site"), ou null. */
  homeUrl: string | null;
  assetUrl: (assetId: string) => string | null;
  /** Para o formulário de serviço (a lista de serviços). */
  services: SiteServiceItem[];
  /** O formulário da landing (a ação já leva a variante, para contar a conversão). */
  form: SiteFormInfo | null;
  /** Letra da variante (`a`, `b`…). */
  variant: string;
}

const FORM_ANCHOR = '#formulario';

export function buildLandingView(input: LandingViewInput) {
  const { landing } = input;
  // Os dados da empresa saem do mesmo montador do site (mesmos nomes e regras).
  const base = buildSiteView({
    content: {
      ...input.site,
      hero: landing.hero,
      theme: {
        ...input.site.theme,
        heroImageAssetId: landing.heroImageAssetId ?? input.site.theme.heroImageAssetId,
      },
      testimonials: landing.testimonials,
      faq: landing.faq,
      seo: landing.seo,
    },
    siteUrl: input.pageUrl,
    assetUrl: input.assetUrl,
    services: input.services,
    professionals: [],
    form: input.form,
  });

  const hasForm = base.contactForm !== null;
  const ctaUrl = hasForm ? FORM_ANCHOR : (base.business.whatsappUrl ?? FORM_ANCHOR);
  const ctaLabel = landing.hero.ctaLabel ?? (hasForm ? 'Quero aproveitar' : 'Chamar no WhatsApp');
  const title = landing.seo.title ?? landing.hero.title ?? input.site.business.name;
  const offer =
    landing.offer.title || landing.offer.price
      ? {
          title: landing.offer.title,
          price: landing.offer.price,
          oldPrice: landing.offer.oldPrice,
          note: landing.offer.note,
        }
      : null;

  return {
    site: {
      url: input.pageUrl,
      homeUrl: input.homeUrl,
      title,
      description: landing.seo.description ?? landing.hero.subtitle ?? null,
      year: base.site.year,
    },
    business: base.business,
    theme: base.theme,
    logo: base.logo,
    heroImage: base.heroImage,
    hero: {
      title: landing.hero.title ?? input.site.business.name,
      subtitle: landing.hero.subtitle,
      ctaLabel,
      ctaUrl,
    },
    intro: landing.intro,
    /** O texto principal em parágrafos (linha em branco separa). */
    introParagraphs: landing.intro
      ? landing.intro
          .split(/\r?\n\s*\r?\n/)
          .map((p) => p.trim())
          .filter(Boolean)
      : [],
    benefits: landing.benefits.map((b) => ({ title: b.title, text: b.text })),
    offer,
    testimonials: base.testimonials,
    faq: base.faq,
    contactForm: base.contactForm
      ? { ...base.contactForm, title: landing.formTitle ?? 'Fale com a gente' }
      : null,
    services: base.services,
    // Tem o que mostrar: o modelo não precisa conferir.
    sections: {
      intro: !!landing.intro,
      benefits: landing.benefits.length > 0,
      offer: offer !== null,
      testimonials: landing.testimonials.length > 0,
      faq: landing.faq.length > 0,
      form: hasForm,
    },
    landing: { variant: input.variant },
  };
}

export type LandingView = ReturnType<typeof buildLandingView>;
