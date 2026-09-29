import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export type MessagingChannel = 'email' | 'sms'
export type ProviderStatus = 'unverified' | 'verified' | 'failing'

export interface EmailSettings {
  provider: 'sendgrid'
  fromEmail: string
  fromName: string
  replyTo: string | null
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
