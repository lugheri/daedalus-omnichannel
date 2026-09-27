import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export type ChannelStatus =
  'pending' | 'awaiting_qr' | 'connecting' | 'connected' | 'disconnected' | 'logged_out'

export interface Channel {
  id: string
  name: string
  provider: 'whatsapp_baileys'
  status: ChannelStatus
  phoneNumber: string | null
  statusReason: string | null
  statusAt: string
  createdAt: string
}

export interface ChannelConnection extends Channel {
  /** Texto a ser desenhado como QR code; `null` fora do pareamento. */
  qrCode: string | null
}

export const channelsApi = {
  list: () => api<Channel[]>('/v1/channels'),
  create: (input: { name: string }) =>
    api<Channel>('/v1/channels', { method: 'POST', body: input }),
  connection: (id: string) => api<ChannelConnection>(`/v1/channels/${id}/connection`),
  connect: (id: string) => api<void>(`/v1/channels/${id}/connect`, { method: 'POST' }),
  disconnect: (id: string) => api<void>(`/v1/channels/${id}/disconnect`, { method: 'POST' }),
  remove: (id: string) => api<void>(`/v1/channels/${id}`, { method: 'DELETE' }),
  sendTestMessage: (id: string, input: { to: string; text: string }) =>
    api<{ messageId: string }>(`/v1/channels/${id}/test-message`, {
      method: 'POST',
      body: input,
    }),
}

export const channelsQueryKey = ['channels'] as const

/** Enquanto algum canal está em transição, atualiza a lista a cada 5 s. */
export function useChannels() {
  return useQuery({
    queryKey: channelsQueryKey,
    queryFn: channelsApi.list,
    refetchInterval: (query) =>
      query.state.data?.some((c) => IN_PROGRESS.has(c.status)) ? 5_000 : false,
  })
}

/** Durante o pareamento, consulta status + QR a cada 2 s (o QR muda a cada ~20 s). */
export function useChannelConnection(id: string | null) {
  return useQuery({
    queryKey: [...channelsQueryKey, id, 'connection'],
    queryFn: () => channelsApi.connection(id!),
    enabled: id !== null,
    refetchInterval: 2_000,
  })
}

/** Só canais parados podem ser removidos (a API recusa os demais com 409). */
export const REMOVABLE = new Set<ChannelStatus>(['disconnected', 'logged_out'])

export const IN_PROGRESS = new Set<ChannelStatus>(['pending', 'awaiting_qr', 'connecting'])
