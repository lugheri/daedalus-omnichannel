import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export interface Team {
  id: string
  name: string
  memberIds: string[]
  createdAt: string
}

export const teamsApi = {
  list: () => api<Team[]>('/v1/teams'),
  create: (name: string) => api<Team>('/v1/teams', { method: 'POST', body: { name } }),
  rename: (id: string, name: string) =>
    api<Team>(`/v1/teams/${id}`, { method: 'PATCH', body: { name } }),
  setMembers: (id: string, memberIds: string[]) =>
    api<Team>(`/v1/teams/${id}/members`, { method: 'PUT', body: { memberIds } }),
  remove: (id: string) => api<void>(`/v1/teams/${id}`, { method: 'DELETE' }),
}

export const teamsQueryKey = ['teams'] as const

/** Lista de equipes: para quem gerencia equipes ou transfere conversas. */
export function useTeams(enabled = true) {
  return useQuery({ queryKey: teamsQueryKey, queryFn: teamsApi.list, enabled })
}
