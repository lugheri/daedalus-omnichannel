import { z } from 'zod';
import { MAX_FAQ_ITEMS, MAX_GALLERY_ITEMS, MAX_TESTIMONIALS } from '../../domain/site-content';
import { MAX_TEMPLATE_HTML_LENGTH } from '../../domain/site-template.entity';

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

export const previewTemplateSchema = z.object({ html: templateHtml });
