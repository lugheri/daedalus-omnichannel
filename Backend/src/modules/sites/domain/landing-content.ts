import { InvalidSiteError } from './errors/invalid-site.error';

export const MAX_LANDING_BENEFITS = 8;
export const MAX_LANDING_TESTIMONIALS = 8;
export const MAX_LANDING_FAQ = 12;

/**
 * Conteúdo de UMA variante de landing page (ADR 0014). Os dados da empresa
 * (nome, logo, cor, WhatsApp, endereço) vêm do site da conta: a landing é a
 * oferta, não a empresa de novo. Os textos são aparados (vazio = null).
 */
export interface LandingContent {
  hero: { title: string | null; subtitle: string | null; ctaLabel: string | null };
  /** Imagem da capa; null = a capa do site. */
  heroImageAssetId: string | null;
  /** Texto principal da oferta (parágrafos separados por linha em branco). */
  intro: string | null;
  benefits: { title: string; text: string | null }[];
  /** Preço "de/por" e observação (texto livre: "R$ 49,90", "3x sem juros"). */
  offer: {
    title: string | null;
    price: string | null;
    oldPrice: string | null;
    note: string | null;
  };
  testimonials: { author: string; text: string }[];
  faq: { question: string; answer: string }[];
  /** Título da seção do formulário (o formulário é o da landing page). */
  formTitle: string | null;
  seo: { title: string | null; description: string | null };
}

export function defaultLandingContent(businessName: string): LandingContent {
  return {
    hero: {
      title: `${businessName}: oferta especial`,
      subtitle: 'Preencha seus dados e fale com a gente.',
      ctaLabel: null,
    },
    heroImageAssetId: null,
    intro: null,
    benefits: [],
    offer: { title: null, price: null, oldPrice: null, note: null },
    testimonials: [],
    faq: [],
    formTitle: null,
    seo: { title: null, description: null },
  };
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Pronto para gravar: textos aparados, itens vazios fora, limites de quantidade. */
export function normalizeLandingContent(input: LandingContent): LandingContent {
  const benefits = input.benefits
    .map((item) => ({ title: text(item.title), text: text(item.text) }))
    .filter((item): item is { title: string; text: string | null } => !!item.title);
  const testimonials = input.testimonials
    .map((item) => ({ author: text(item.author), text: text(item.text) }))
    .filter((item): item is { author: string; text: string } => !!item.author && !!item.text);
  const faq = input.faq
    .map((item) => ({ question: text(item.question), answer: text(item.answer) }))
    .filter(
      (item): item is { question: string; answer: string } => !!item.question && !!item.answer,
    );
  if (
    benefits.length > MAX_LANDING_BENEFITS ||
    testimonials.length > MAX_LANDING_TESTIMONIALS ||
    faq.length > MAX_LANDING_FAQ
  ) {
    throw new InvalidSiteError('LANDING_TOO_MANY_ITEMS');
  }
  return {
    hero: {
      title: text(input.hero.title),
      subtitle: text(input.hero.subtitle),
      ctaLabel: text(input.hero.ctaLabel),
    },
    heroImageAssetId: input.heroImageAssetId ?? null,
    intro: text(input.intro),
    benefits,
    offer: {
      title: text(input.offer.title),
      price: text(input.offer.price),
      oldPrice: text(input.offer.oldPrice),
      note: text(input.offer.note),
    },
    testimonials,
    faq,
    formTitle: text(input.formTitle),
    seo: { title: text(input.seo.title), description: text(input.seo.description) },
  };
}

export function landingAssetIds(content: LandingContent): string[] {
  return content.heroImageAssetId ? [content.heroImageAssetId] : [];
}

/** JSON gravado numa versão anterior completado com os padrões (campo novo sem migration). */
export function completeLandingContent(stored: Partial<LandingContent>): LandingContent {
  const base = defaultLandingContent('');
  return {
    ...base,
    ...stored,
    hero: { ...base.hero, ...stored.hero },
    offer: { ...base.offer, ...stored.offer },
    seo: { ...base.seo, ...stored.seo },
  };
}
