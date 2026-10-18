import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export const SITE_SECTIONS = [
  'about',
  'services',
  'professionals',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'map',
  'booking',
] as const
export type SiteSection = (typeof SITE_SECTIONS)[number]

/** Espelho de `domain/site-content.ts` do backend. Texto vazio = sem. */
export interface SiteContent {
  business: {
    name: string
    tagline: string | null
    about: string | null
    phone: string | null
    whatsapp: string | null
    email: string | null
    address: string | null
    hours: string | null
    instagram: string | null
    facebook: string | null
  }
  theme: { primaryColor: string; logoAssetId: string | null; heroImageAssetId: string | null }
  hero: { title: string | null; subtitle: string | null; ctaLabel: string | null }
  sections: Record<SiteSection, boolean>
  gallery: { assetId: string; caption: string | null }[]
  testimonials: { author: string; text: string }[]
  faq: { question: string; answer: string }[]
  contactFormId: string | null
  /** Chat do site (canal) que aparece no site, ou null. */
  chatChannelId: string | null
  seo: { title: string | null; description: string | null }
}

export const MAX_GALLERY_ITEMS = 24
export const MAX_TESTIMONIALS = 20
export const MAX_FAQ_ITEMS = 30

export interface Site {
  id: string
  templateId: string
  templateName: string | null
  slug: string
  /** Endereço do rascunho (null sem bucket de sites configurado). */
  url: string | null
  /** Onde está no ar agora (null = fora do ar). */
  liveUrl: string | null
  content: SiteContent
  isLive: boolean
  hasUnpublishedChanges: boolean
  pendingAction: 'publish' | 'unpublish' | null
  /** Código do motivo da última publicação que falhou. */
  lastError: string | null
  /** Domínio próprio (ADR 0011), ex.: www.barbearia.com.br. */
  customDomain: string | null
  /** O domínio que está no ar (difere do `customDomain` até publicar de novo). */
  publishedDomain: string | null
  domainStatus: 'pending' | 'checking' | 'connected' | 'unreachable' | null
  domainCheckedAt: string | null
  publishedAt: string | null
  updatedAt: string
}

export interface SiteState {
  site: Site | null
  publishingEnabled: boolean
  /** Ex.: `https://{slug}.meusites.com.br`. */
  addressPattern: string | null
  /** Para onde o CNAME do domínio próprio aponta (o túnel); null = não configurado. */
  domainTarget: string | null
  /** Quem está logado pode definir o domínio próprio (conta-mãe ou plataforma). */
  canManageDomain: boolean
}

export interface SiteTemplateSummary {
  id: string
  name: string
  niche: string | null
  description: string | null
  available: boolean
  /** Só na lista da conta da plataforma: quantos sites usam. */
  sites?: number
  createdAt: string
  updatedAt: string
}

export interface SiteTemplate extends SiteTemplateSummary {
  html: string
}

export interface SiteAsset {
  id: string
  fileName: string | null
  contentType: string
  size: number
  url: string | null
  createdAt: string
}

export type SiteChanges = {
  content?: SiteContent
  slug?: string
  templateId?: string
  /** null = tira o domínio próprio. */
  customDomain?: string | null
}

export const sitesApi = {
  get: () => api<SiteState>('/v1/site'),
  create: (templateId: string) => api<Site>('/v1/site', { method: 'POST', body: { templateId } }),
  update: (changes: SiteChanges) => api<Site>('/v1/site', { method: 'PATCH', body: changes }),
  /** HTML como ficaria (conteúdo em edição, sem gravar). */
  preview: (input: { content?: SiteContent; templateId?: string }) =>
    api<{ html: string }>('/v1/site/preview', { method: 'POST', body: input }),
  publish: () => api<Site>('/v1/site/publish', { method: 'POST' }),
  unpublish: () => api<Site>('/v1/site/unpublish', { method: 'POST' }),
  /** Confere de novo se o domínio próprio chega no site. */
  checkDomain: () => api<Site>('/v1/site/domain/check', { method: 'POST' }),
  assets: () => api<SiteAsset[]>('/v1/site/assets'),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api<SiteAsset>('/v1/site/assets', { method: 'POST', body: form })
  },
  removeAsset: (id: string) => api<void>(`/v1/site/assets/${id}`, { method: 'DELETE' }),
  availableTemplates: () => api<SiteTemplateSummary[]>('/v1/site-templates/available'),
}

/** Modelos (só na conta da plataforma). */
export const templatesApi = {
  list: () => api<SiteTemplateSummary[]>('/v1/site-templates'),
  get: (id: string) => api<SiteTemplate>(`/v1/site-templates/${id}`),
  create: (input: { name: string; niche: string | null }) =>
    api<SiteTemplate>('/v1/site-templates', { method: 'POST', body: input }),
  update: (
    id: string,
    input: Partial<Pick<SiteTemplate, 'name' | 'niche' | 'description' | 'html' | 'available'>>,
  ) => api<SiteTemplate>(`/v1/site-templates/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => api<void>(`/v1/site-templates/${id}`, { method: 'DELETE' }),
  /** O HTML em edição com o site de exemplo. */
  preview: (html: string) =>
    api<{ html: string }>('/v1/site-templates/preview', { method: 'POST', body: { html } }),
}

export const siteKeys = {
  site: ['site'] as const,
  assets: ['site', 'assets'] as const,
  available: ['site', 'templates', 'available'] as const,
  templates: ['site-templates'] as const,
  template: (id: string) => ['site-templates', id] as const,
}

/** Enquanto o worker publica ou verifica o domínio, consulta de novo a cada 1,5 s. */
export function useSiteState() {
  return useQuery({
    queryKey: siteKeys.site,
    queryFn: sitesApi.get,
    refetchInterval: (query) => {
      const site = query.state.data?.site
      return site?.pendingAction || site?.domainStatus === 'checking' ? 1500 : false
    },
  })
}

export function useSiteAssets() {
  return useQuery({ queryKey: siteKeys.assets, queryFn: sitesApi.assets })
}

export function useAvailableTemplates() {
  return useQuery({ queryKey: siteKeys.available, queryFn: sitesApi.availableTemplates })
}

export function useSiteTemplates() {
  return useQuery({ queryKey: siteKeys.templates, queryFn: templatesApi.list })
}

export function useSiteTemplate(id: string) {
  return useQuery({ queryKey: siteKeys.template(id), queryFn: () => templatesApi.get(id) })
}

/** Por que a última publicação falhou, em português. */
export const PUBLISH_ERRORS: Record<string, string> = {
  SITE_TEMPLATE_INVALID_HTML: 'O modelo do site tem um erro. Avise quem gerencia a sua conta.',
  SITE_TEMPLATE_NOT_FOUND: 'O modelo do site não existe mais. Escolha outro.',
  SITE_HOSTING_UNAVAILABLE: 'O servidor dos sites não respondeu. Tente publicar de novo.',
}
