import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

/** Espelho de `domain/landing-content.ts` do backend. Texto vazio = sem. */
export interface LandingContent {
  hero: { title: string | null; subtitle: string | null; ctaLabel: string | null }
  /** Imagem da capa; null = a capa do site. */
  heroImageAssetId: string | null
  intro: string | null
  benefits: { title: string; text: string | null }[]
  offer: {
    title: string | null
    price: string | null
    oldPrice: string | null
    note: string | null
  }
  testimonials: { author: string; text: string }[]
  faq: { question: string; answer: string }[]
  formTitle: string | null
  seo: { title: string | null; description: string | null }
}

export const MAX_BENEFITS = 8
export const MAX_TESTIMONIALS = 8
export const MAX_FAQ = 12
export const MAX_VARIANTS = 4

export interface LandingVariant {
  id: string
  /** a, b, c ou d. */
  code: string
  name: string
  templateId: string
  templateName: string | null
  content: LandingContent
  /** Peso na divisão do tráfego; 0 = fora do teste. */
  weight: number
  updatedAt: string
}

interface PublicationState {
  isLive: boolean
  /** Mais de uma variante com peso. */
  isTesting: boolean
  hasUnpublishedChanges: boolean
  pendingAction: 'publish' | 'unpublish' | null
  lastError: string | null
  publishedAt: string | null
}

export interface LandingPage extends PublicationState {
  id: string
  name: string
  path: string
  /** Endereço (no site da conta); null sem publicação configurada. */
  url: string | null
  formId: string | null
  variants: LandingVariant[]
  createdAt: string
  updatedAt: string
}

export interface LandingListItem extends PublicationState {
  id: string
  name: string
  path: string
  url: string | null
  variants: number
  views: number
  conversions: number
  createdAt: string
}

export type Verdict = 'insufficient' | 'inconclusive' | 'better' | 'worse'

export interface VariantStats {
  variantId: string
  code: string
  name: string
  weight: number
  views: number
  conversions: number
  rate: number | null
  /** Comparação com a variante A (null na própria A). */
  comparison: { lift: number | null; pValue: number | null; verdict: Verdict } | null
}

export interface VariantChanges {
  name?: string
  templateId?: string
  content?: LandingContent
  weight?: number
}

const base = '/v1/landing-pages'

export const landingApi = {
  list: () => api<{ hasSite: boolean; items: LandingListItem[] }>(base),
  get: (id: string) => api<LandingPage>(`${base}/${id}`),
  create: (input: { name: string; path: string; templateId: string; formId: string | null }) =>
    api<LandingPage>(base, { method: 'POST', body: input }),
  update: (id: string, input: { name?: string; path?: string; formId?: string | null }) =>
    api<LandingPage>(`${base}/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => api<void>(`${base}/${id}`, { method: 'DELETE' }),
  addVariant: (id: string, copyFrom: string | null) =>
    api<LandingPage & { createdVariantId: string }>(`${base}/${id}/variants`, {
      method: 'POST',
      body: { copyFrom },
    }),
  updateVariant: (id: string, variantId: string, changes: VariantChanges) =>
    api<LandingPage>(`${base}/${id}/variants/${variantId}`, { method: 'PATCH', body: changes }),
  removeVariant: (id: string, variantId: string) =>
    api<LandingPage>(`${base}/${id}/variants/${variantId}`, { method: 'DELETE' }),
  chooseWinner: (id: string, variantId: string) =>
    api<LandingPage>(`${base}/${id}/variants/${variantId}/winner`, { method: 'POST' }),
  preview: (
    id: string,
    input: { variantId: string; templateId?: string; content?: LandingContent },
  ) => api<{ html: string }>(`${base}/${id}/preview`, { method: 'POST', body: input }),
  publish: (id: string) => api<LandingPage>(`${base}/${id}/publish`, { method: 'POST' }),
  unpublish: (id: string) => api<LandingPage>(`${base}/${id}/unpublish`, { method: 'POST' }),
  stats: (id: string) => api<VariantStats[]>(`${base}/${id}/stats`),
  resetStats: (id: string) => api<void>(`${base}/${id}/stats/reset`, { method: 'POST' }),
}

export const landingKeys = {
  all: ['landing-pages'] as const,
  list: ['landing-pages', 'list'] as const,
  page: (id: string) => ['landing-pages', id] as const,
  stats: (id: string) => ['landing-pages', id, 'stats'] as const,
}

export function useLandingPages() {
  return useQuery({ queryKey: landingKeys.list, queryFn: landingApi.list })
}

/** Enquanto o worker publica, consulta de novo a cada 1,5 s. */
export function useLandingPage(id: string) {
  return useQuery({
    queryKey: landingKeys.page(id),
    queryFn: () => landingApi.get(id),
    refetchInterval: (query) => (query.state.data?.pendingAction ? 1500 : false),
  })
}

/** Os números mudam com as visitas: atualiza a cada 30 s com a tela aberta. */
export function useLandingStats(id: string) {
  return useQuery({
    queryKey: landingKeys.stats(id),
    queryFn: () => landingApi.stats(id),
    refetchInterval: 30_000,
  })
}

/** "dia-dos-pais" a partir de "Dia dos Pais!" (o backend valida de novo). */
export function suggestPath(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}
