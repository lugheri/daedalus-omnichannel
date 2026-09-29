import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export type MessagingChannel = 'email' | 'sms'
export type ProviderStatus = 'unverified' | 'verified' | 'failing'

export interface EmailSettings {
  provider: 'sendgrid'
  fromEmail: string
  fromName: string
  replyTo: string | null
  /** Chave pública do Signed Event Webhook (não é segredo). */
  eventWebhookKey: string | null
}

export interface SmsSettings {
  provider: 'twilio'
  accountSid: string
  from: string | null
  messagingServiceSid: string | null
}

export interface ProviderView<S> {
  channel: MessagingChannel
  settings: S
  /** Final do segredo salvo (o segredo em si nunca volta da API). */
  secretHint: string
  status: ProviderStatus
  lastCheckedAt: string | null
  /** Mensagem do provedor no último teste que falhou. */
  lastError: string | null
  updatedAt: string
  /** Endereços para colar no painel do provedor; `reachable` = a API é pública (https). */
  webhooks: { reachable: boolean; events?: string; inbound?: string }
}

export interface MessagingProviders {
  email: ProviderView<EmailSettings> | null
  sms: ProviderView<SmsSettings> | null
}

export const messagingApi = {
  providers: () => api<MessagingProviders>('/v1/messaging/providers'),
  /** `apiKey` ausente = manter a salva. */
  saveEmail: (input: {
    fromEmail: string
    fromName: string
    replyTo?: string | null
    eventWebhookKey?: string | null
    apiKey?: string
  }) =>
    api<ProviderView<EmailSettings>>('/v1/messaging/providers/email', {
      method: 'PUT',
      body: input,
    }),
  /** `authToken` ausente = manter o salvo. Remetente: `from` OU `messagingServiceSid`. */
  saveSms: (input: {
    accountSid: string
    authToken?: string
    from?: string | null
    messagingServiceSid?: string | null
  }) =>
    api<ProviderView<SmsSettings>>('/v1/messaging/providers/sms', { method: 'PUT', body: input }),
  remove: (channel: MessagingChannel) =>
    api<void>(`/v1/messaging/providers/${channel}`, { method: 'DELETE' }),
  test: (channel: MessagingChannel, to: string) =>
    api<ProviderView<unknown>>(`/v1/messaging/providers/${channel}/test`, {
      method: 'POST',
      body: { to },
    }),
}

export const messagingKeys = { providers: ['messaging', 'providers'] as const }

export function useMessagingProviders() {
  return useQuery({ queryKey: messagingKeys.providers, queryFn: messagingApi.providers })
}

export type OutboundStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced'

export interface OutboundMessage {
  id: string
  channel: MessagingChannel
  contactId: string
  to: string
  subject: string | null
  body: string
  status: OutboundStatus
  /** Motivo da falha (mensagem do provedor) ou da última tentativa. */
  error: string | null
  sentByMembershipId: string | null
  campaignId: string | null
  createdAt: string
  sentAt: string | null
  deliveredAt: string | null
}

export interface OptOut {
  channel: MessagingChannel
  address: string
  source: 'unsubscribe_link' | 'sms_reply' | 'provider' | 'manual'
  createdAt: string
}

export const contactMessagingApi = {
  /** Quais canais a conta configurou (para quem envia pela ficha). */
  channels: () => api<Record<MessagingChannel, boolean>>('/v1/messaging/channels'),
  send: (contactId: string, input: { channel: MessagingChannel; subject?: string; body: string }) =>
    api<OutboundMessage>(`/v1/messaging/contacts/${contactId}/messages`, {
      method: 'POST',
      body: input,
    }),
  messages: (contactId: string) =>
    api<OutboundMessage[]>(`/v1/messaging/contacts/${contactId}/messages`),
  optOuts: (contactId: string) => api<OptOut[]>(`/v1/messaging/contacts/${contactId}/opt-outs`),
  reactivate: (contactId: string, channel: MessagingChannel) =>
    api<void>(`/v1/messaging/contacts/${contactId}/opt-outs/${channel}`, { method: 'DELETE' }),
}

export const contactMessagingKeys = {
  channels: ['messaging', 'channels'] as const,
  messages: (contactId: string) => ['messaging', 'contact-messages', contactId] as const,
  optOuts: (contactId: string) => ['messaging', 'contact-opt-outs', contactId] as const,
}

export function useAvailableChannels(enabled: boolean) {
  return useQuery({
    queryKey: contactMessagingKeys.channels,
    queryFn: contactMessagingApi.channels,
    enabled,
    staleTime: 60_000,
  })
}

/** Enquanto houver mensagem a caminho, atualiza sozinho (o status vem do provedor). */
export function useContactMessages(contactId: string) {
  return useQuery({
    queryKey: contactMessagingKeys.messages(contactId),
    queryFn: () => contactMessagingApi.messages(contactId),
    refetchInterval: (query) =>
      query.state.data?.some((m) => m.status === 'queued' || m.status === 'sent') ? 5_000 : false,
  })
}

export function useContactOptOuts(contactId: string) {
  return useQuery({
    queryKey: contactMessagingKeys.optOuts(contactId),
    queryFn: () => contactMessagingApi.optOuts(contactId),
  })
}
