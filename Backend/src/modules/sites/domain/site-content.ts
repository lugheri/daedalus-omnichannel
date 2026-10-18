import { normalizePhoneNumber } from '../../../shared/domain/phone-number';
import { InvalidSiteError } from './errors/invalid-site.error';

/** Seções que o dono liga e desliga (o modelo decide como cada uma aparece). */
export const SITE_SECTIONS = [
  'about',
  'services',
  'professionals',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'map',
] as const;
export type SiteSection = (typeof SITE_SECTIONS)[number];

export const MAX_GALLERY_ITEMS = 24;
export const MAX_TESTIMONIALS = 20;
export const MAX_FAQ_ITEMS = 30;

const HEX_COLOR = /^#[0-9a-f]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SiteBusiness {
  name: string;
  tagline: string | null;
  about: string | null;
  /** Como o dono quer que apareça: "(11) 3333-4444". */
  phone: string | null;
  /** E.164 (normalizado ao salvar): vira o link do wa.me. */
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  /** Texto livre, uma linha por dia ou faixa: "Seg a sex: 9h às 18h". */
  hours: string | null;
  /** @perfil ou endereço. */
  instagram: string | null;
  facebook: string | null;
}

/**
 * Conteúdo do site de uma conta. O mesmo conteúdo serve para qualquer modelo:
 * trocar de modelo muda só a aparência. Serviços e profissionais não ficam
 * aqui — vêm do catálogo (os marcados "mostrar no site") na hora de gerar.
 */
export interface SiteContent {
  business: SiteBusiness;
  theme: {
    primaryColor: string;
    logoAssetId: string | null;
    heroImageAssetId: string | null;
  };
  hero: { title: string | null; subtitle: string | null; ctaLabel: string | null };
  sections: Record<SiteSection, boolean>;
  gallery: { assetId: string; caption: string | null }[];
  testimonials: { author: string; text: string }[];
  faq: { question: string; answer: string }[];
  /** Formulário do módulo forms mostrado na seção de contato. */
  contactFormId: string | null;
  /** Chat do site (canal do módulo channels) que aparece no site, ou null. */
  chatChannelId: string | null;
  seo: { title: string | null; description: string | null };
}

export function defaultSiteContent(businessName: string): SiteContent {
  return {
    business: {
      name: businessName,
      tagline: null,
      about: null,
      phone: null,
      whatsapp: null,
      email: null,
      address: null,
      hours: null,
      instagram: null,
      facebook: null,
    },
    theme: { primaryColor: '#2f5bd7', logoAssetId: null, heroImageAssetId: null },
    hero: { title: null, subtitle: null, ctaLabel: null },
    sections: {
      about: true,
      services: true,
      professionals: true,
      gallery: true,
      testimonials: true,
      faq: true,
      contact: true,
      map: true,
    },
    gallery: [],
    testimonials: [],
    faq: [],
    contactFormId: null,
    chatChannelId: null,
    seo: { title: null, description: null },
  };
}

/** Texto aparado; vazio vira null. */
function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Conteúdo pronto para gravar: textos aparados (vazio = sem), WhatsApp em
 * E.164, cor em minúsculas e listas sem itens vazios — ou o erro da regra
 * violada. Tamanhos de texto são conferidos na borda (HTTP).
 */
export function normalizeSiteContent(input: SiteContent): SiteContent {
  const name = text(input.business.name);
  if (!name) throw new InvalidSiteError('SITE_INVALID_BUSINESS_NAME');

  let whatsapp = text(input.business.whatsapp);
  if (whatsapp) {
    whatsapp = normalizePhoneNumber(whatsapp);
    if (!whatsapp) throw new InvalidSiteError('SITE_INVALID_WHATSAPP');
  }
  const email = text(input.business.email)?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) throw new InvalidSiteError('SITE_INVALID_EMAIL');

  const primaryColor = input.theme.primaryColor.trim().toLowerCase();
  if (!HEX_COLOR.test(primaryColor)) throw new InvalidSiteError('SITE_INVALID_COLOR');

  const gallery = input.gallery.map((item) => ({
    assetId: item.assetId,
    caption: text(item.caption),
  }));
  const testimonials = input.testimonials
    .map((item) => ({ author: text(item.author), text: text(item.text) }))
    .filter((item): item is { author: string; text: string } => !!item.author && !!item.text);
  const faq = input.faq
    .map((item) => ({ question: text(item.question), answer: text(item.answer) }))
    .filter(
      (item): item is { question: string; answer: string } => !!item.question && !!item.answer,
    );
  if (
    gallery.length > MAX_GALLERY_ITEMS ||
    testimonials.length > MAX_TESTIMONIALS ||
    faq.length > MAX_FAQ_ITEMS
  ) {
    throw new InvalidSiteError('SITE_TOO_MANY_ITEMS');
  }

  const b = input.business;
  return {
    business: {
      name,
      tagline: text(b.tagline),
      about: text(b.about),
      phone: text(b.phone),
      whatsapp,
      email,
      address: text(b.address),
      hours: text(b.hours),
      instagram: text(b.instagram),
      facebook: text(b.facebook),
    },
    theme: {
      primaryColor,
      logoAssetId: input.theme.logoAssetId ?? null,
      heroImageAssetId: input.theme.heroImageAssetId ?? null,
    },
    hero: {
      title: text(input.hero.title),
      subtitle: text(input.hero.subtitle),
      ctaLabel: text(input.hero.ctaLabel),
    },
    sections: Object.fromEntries(
      SITE_SECTIONS.map((section) => [section, input.sections[section] === true]),
    ) as Record<SiteSection, boolean>,
    gallery,
    testimonials,
    faq,
    contactFormId: input.contactFormId ?? null,
    chatChannelId: input.chatChannelId ?? null,
    seo: { title: text(input.seo.title), description: text(input.seo.description) },
  };
}

/** Imagens que o conteúdo usa (para conferir que existem e impedir a exclusão). */
export function referencedAssetIds(content: SiteContent): string[] {
  const ids = [
    content.theme.logoAssetId,
    content.theme.heroImageAssetId,
    ...content.gallery.map((item) => item.assetId),
  ];
  return [...new Set(ids.filter((id): id is string => !!id))];
}

/**
 * Conteúdo gravado numa versão anterior completado com os padrões: campo
 * novo no conteúdo não exige migration (o JSON antigo continua valendo).
 */
export function completeSiteContent(stored: Partial<SiteContent>): SiteContent {
  const base = defaultSiteContent(stored.business?.name ?? '');
  return {
    ...base,
    ...stored,
    business: { ...base.business, ...stored.business },
    theme: { ...base.theme, ...stored.theme },
    hero: { ...base.hero, ...stored.hero },
    sections: { ...base.sections, ...stored.sections },
    seo: { ...base.seo, ...stored.seo },
  };
}
