import { useQuery } from '@tanstack/react-query'
import type { LeadSource } from '@/features/contacts/api'
import type { MessagingChannel, OutboundStatus } from '@/features/messaging/api'
import { api } from '@/lib/api/client'

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'canceled'

export interface CampaignAudience {
  search?: string
  source?: LeadSource
  sourceDetail?: string
}

export interface Campaign {
  id: string
  name: string
  channel: MessagingChannel
  subject: string | null
  body: string
  audience: CampaignAudience
  status: CampaignStatus
  scheduledAt: string | null
  startedAt: string | null
  finishedAt: string | null
  queuedCount: number
  skippedNoAddress: number
  skippedOptedOut: number
  createdByMembershipId: string
  createdAt: string
}

export interface CampaignReport extends Campaign {
  /** Mensagens por status (as que entraram na fila). */
  counts: Record<OutboundStatus, number>
}

export interface Recipient {
  messageId: string
  contactId: string
  contactName: string | null
  to: string
  status: OutboundStatus
  error: string | null
  sentAt: string | null
  deliveredAt: string | null
}

export interface CampaignInput {
  name: string
  subject?: string | null
  body: string
  audience: CampaignAudience
}

interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export const campaignsApi = {
  list: (cursor?: string) => api<Page<Campaign>>('/v1/campaigns', { query: { cursor, limit: 25 } }),
  get: (id: string) => api<CampaignReport>(`/v1/campaigns/${id}`),
  create: (input: CampaignInput & { channel: MessagingChannel }) =>
    api<Campaign>('/v1/campaigns', { method: 'POST', body: input }),
  update: (id: string, input: Partial<CampaignInput>) =>
    api<Campaign>(`/v1/campaigns/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => api<void>(`/v1/campaigns/${id}`, { method: 'DELETE' }),
  /** `at` null = enviar agora. */
  schedule: (id: string, at: string | null) =>
    api<Campaign>(`/v1/campaigns/${id}/schedule`, { method: 'POST', body: { at } }),
  unschedule: (id: string) => api<Campaign>(`/v1/campaigns/${id}/unschedule`, { method: 'POST' }),
  cancel: (id: string) => api<Campaign>(`/v1/campaigns/${id}/cancel`, { method: 'POST' }),
  preview: (channel: MessagingChannel, audience: CampaignAudience) =>
    api<{ total: number; reachable: number }>('/v1/campaigns/preview-audience', {
      method: 'POST',
      body: { channel, audience },
    }),
  recipients: (id: string, status?: OutboundStatus) =>
    api<Page<Recipient>>(`/v1/campaigns/${id}/recipients`, { query: { status, limit: 200 } }),
}

export const campaignKeys = {
  all: ['campaigns'] as const,
  list: ['campaigns', 'list'] as const,
  detail: (id: string) => ['campaigns', 'detail', id] as const,
  recipients: (id: string, status?: OutboundStatus) =>
    ['campaigns', 'recipients', id, status ?? 'all'] as const,
  preview: (channel: MessagingChannel, audience: CampaignAudience) =>
    ['campaigns', 'preview', channel, audience] as const,
}

/**
 * Ainda está saindo (montando o público, ou mensagens esperando a vez na
 * fila)? "Enviado" não conta: já saiu, e o aviso de entrega pode nunca vir
 * (sem webhook configurado).
 */
export function isInProgress(campaign: CampaignReport | undefined): boolean {
  if (!campaign) return false
  if (campaign.status === 'sending') return true
  return campaign.status === 'sent' && campaign.counts.queued > 0
}

export function useCampaigns() {
  return useQuery({ queryKey: campaignKeys.list, queryFn: () => campaignsApi.list() })
}

/** Atualiza sozinho enquanto a campanha está saindo. */
export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: campaignKeys.detail(id ?? ''),
    queryFn: () => campaignsApi.get(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => (isInProgress(query.state.data) ? 5_000 : false),
  })
}

export function useRecipients(id: string, status: OutboundStatus | undefined, live: boolean) {
  return useQuery({
    queryKey: campaignKeys.recipients(id, status),
    queryFn: () => campaignsApi.recipients(id, status),
    refetchInterval: live ? 5_000 : false,
  })
}

export function useAudiencePreview(channel: MessagingChannel, audience: CampaignAudience) {
  return useQuery({
    queryKey: campaignKeys.preview(channel, audience),
    queryFn: () => campaignsApi.preview(channel, audience),
    staleTime: 10_000,
  })
}
