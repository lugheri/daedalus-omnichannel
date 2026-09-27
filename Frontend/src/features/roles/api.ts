import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { RoleSummary } from '@/features/auth/api'

export interface Role extends RoleSummary {
  permissions: string[]
  isSystem: boolean
}

export const rolesApi = {
  list: () => api<Role[]>('/v1/roles'),
  create: (input: { name: string; permissions: string[] }) =>
    api<Role>('/v1/roles', { method: 'POST', body: input }),
  update: (id: string, input: { name?: string; permissions?: string[] }) =>
    api<Role>(`/v1/roles/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => api<void>(`/v1/roles/${id}`, { method: 'DELETE' }),
}

export const rolesQueryKey = ['roles'] as const

export function useRoles() {
  return useQuery({ queryKey: rolesQueryKey, queryFn: rolesApi.list })
}
