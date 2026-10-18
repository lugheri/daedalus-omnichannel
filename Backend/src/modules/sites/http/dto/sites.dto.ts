import { z } from 'zod';
import { MAX_FAQ_ITEMS, MAX_GALLERY_ITEMS, MAX_TESTIMONIALS } from '../../domain/site-content';
import {
  MAX_LANDING_BENEFITS,
  MAX_LANDING_FAQ,
  MAX_LANDING_TESTIMONIALS,
} from '../../domain/landing-content';
import { MAX_TEMPLATE_HTML_LENGTH, SITE_TEMPLATE_KINDS } from '../../domain/site-template.entity';

/** Texto opcional: ausente ou vazio = sem (o domínio apara e troca "" por null). */
const optional = (max: number) => z.string().max(max).nullable().default(null);

/** Formato e tamanhos; as regras (WhatsApp, cor, e-mail) ficam no domínio. */
export const siteContentSchema = z.object({
  business: z.object({
    name: z.string().max(120),
    tagline: optional(160),
    about: optional(3000),
    phone: optional(40),
    whatsapp: optional(40),
    email: optional(320),
    address: optional(300),
    hours: optional(500),
    instagram: optional(200),
    facebook: optional(300),
  }),
  theme: z.object({
    primaryColor: z.string().max(7),
    logoAssetId: z.uuid().nullable().default(null),
    heroImageAssetId: z.uuid().nullable().default(null),
  }),
  hero: z.object({ title: optional(160), subtitle: optional(300), ctaLabel: optional(40) }),
  sections: z.object({
    about: z.boolean(),
    services: z.boolean(),
    professionals: z.boolean(),
    gallery: z.boolean(),
    testimonials: z.boolean(),
    faq: z.boolean(),
    contact: z.boolean(),
    map: z.boolean(),
    booking: z.boolean().default(true),
  }),
  gallery: z.array(z.object({ assetId: z.uuid(), caption: optional(160) })).max(MAX_GALLERY_ITEMS),
  testimonials: z
    .array(z.object({ author: z.string().max(80), text: z.string().max(600) }))
    .max(MAX_TESTIMONIALS),
  faq: z
    .array(z.object({ question: z.string().max(200), answer: z.string().max(1500) }))
    .max(MAX_FAQ_ITEMS),
  contactFormId: z.uuid().nullable().default(null),
  chatChannelId: z.uuid().nullable().default(null),
  seo: z.object({ title: optional(120), description: optional(300) }),
});

export const createSiteSchema = z.object({ templateId: z.uuid() });

export const updateSiteSchema = z.object({
  content: siteContentSchema.optional(),
  slug: z.string().max(63).optional(),
  templateId: z.uuid().optional(),
  /** Domínio próprio (null ou "" = tira). Só conta-mãe ou plataforma (ADR 0011). */
  customDomain: z.string().max(300).nullable().optional(),
});

export const previewSiteSchema = z.object({
  content: siteContentSchema.optional(),
  templateId: z.uuid().optional(),
});

const templateHtml = z.string().max(MAX_TEMPLATE_HTML_LENGTH);

export const createTemplateSchema = z.object({
  name: z.string().max(200),
  /** Não muda depois: site ou landing page. */
  kind: z.enum(SITE_TEMPLATE_KINDS).default('site'),
  niche: optional(200),
  description: optional(1000),
  /** Ausente: nasce com o HTML do modelo inicial. */
  html: templateHtml.nullable().default(null),
});

export const updateTemplateSchema = z.object({
  name: z.string().max(200).optional(),
  niche: z.string().max(200).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  html: templateHtml.optional(),
  available: z.boolean().optional(),
});

export const previewTemplateSchema = z.object({
  html: templateHtml,
  kind: z.enum(SITE_TEMPLATE_KINDS).default('site'),
});

export const availableTemplatesQuery = z.object({
  kind: z.enum(SITE_TEMPLATE_KINDS).default('site'),
});

// ── landing pages (ADR 0014) ────────────────────────────────────────────────

export const landingContentSchema = z.object({
  hero: z.object({ title: optional(160), subtitle: optional(300), ctaLabel: optional(40) }),
  heroImageAssetId: z.uuid().nullable().default(null),
  intro: optional(4000),
  benefits: z
    .array(z.object({ title: z.string().max(120), text: optional(400) }))
    .max(MAX_LANDING_BENEFITS),
  offer: z.object({
    title: optional(120),
    price: optional(40),
    oldPrice: optional(40),
    note: optional(200),
  }),
  testimonials: z
    .array(z.object({ author: z.string().max(80), text: z.string().max(600) }))
    .max(MAX_LANDING_TESTIMONIALS),
  faq: z
    .array(z.object({ question: z.string().max(200), answer: z.string().max(1500) }))
    .max(MAX_LANDING_FAQ),
  formTitle: optional(120),
  seo: z.object({ title: optional(120), description: optional(300) }),
});

export const createLandingSchema = z.object({
  name: z.string().max(200),
  path: z.string().max(100),
  templateId: z.uuid(),
  formId: z.uuid().nullable().default(null),
});

export const updateLandingSchema = z.object({
  name: z.string().max(200).optional(),
  path: z.string().max(100).optional(),
  formId: z.uuid().nullable().optional(),
});

export const addVariantSchema = z.object({ copyFrom: z.uuid().nullable().default(null) });

export const updateVariantSchema = z.object({
  name: z.string().max(200).optional(),
  templateId: z.uuid().optional(),
  content: landingContentSchema.optional(),
  weight: z.number().int().optional(),
});

export const previewLandingSchema = z.object({
  variantId: z.uuid(),
  templateId: z.uuid().optional(),
  content: landingContentSchema.optional(),
});
