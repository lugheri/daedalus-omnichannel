import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export interface ApiKey {
  id: string
  name: string
  /** Início do segredo, para reconhecer a chave (o segredo não volta nunca mais). */
  hint: string
  active: boolean
  createdByMembershipId: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export const apiKeysApi = {
  list: () => api<ApiKey[]>('/v1/api-keys'),
  /** A resposta traz `key` completa — a única vez. */
  create: (name: string) =>
    api<ApiKey & { key: string }>('/v1/api-keys', { method: 'POST', body: { name } }),
  revoke: (id: string) => api<void>(`/v1/api-keys/${id}`, { method: 'DELETE' }),
}

export const apiKeysQueryKey = ['api-keys'] as const

export function useApiKeys() {
  return useQuery({ queryKey: apiKeysQueryKey, queryFn: apiKeysApi.list })
}
