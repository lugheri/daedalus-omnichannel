import { useQuery } from '@tanstack/react-query'
import type { RoleSummary } from '@/features/auth/api'
import { api } from '@/lib/api/client'

export interface Member {
  id: string
  user: { id: string; name: string; email: string }
  role: RoleSummary
  status: 'invited' | 'active' | 'disabled'
  joinedAt: string
}

export interface Invitation {
  id: string
  email: string
  roleId: string
  status: 'pending' | 'accepted' | 'revoked'
  expiresAt: string
  createdAt: string
}

export const membersApi = {
  list: () => api<Member[]>('/v1/members'),
  changeRole: (membershipId: string, roleId: string) =>
    api<void>(`/v1/members/${membershipId}/role`, { method: 'PATCH', body: { roleId } }),
  disable: (membershipId: string) =>
    api<void>(`/v1/members/${membershipId}/disable`, { method: 'POST' }),
  enable: (membershipId: string) =>
    api<void>(`/v1/members/${membershipId}/enable`, { method: 'POST' }),

  listInvitations: () => api<Invitation[]>('/v1/invitations'),
  invite: (input: { email: string; roleId: string }) =>
    api<Invitation & { inviteUrl: string }>('/v1/invitations', { method: 'POST', body: input }),
  revokeInvitation: (id: string) => api<void>(`/v1/invitations/${id}`, { method: 'DELETE' }),
}

export const membersQueryKey = ['members'] as const
export const invitationsQueryKey = ['invitations'] as const

export function useMembers() {
  return useQuery({ queryKey: membersQueryKey, queryFn: membersApi.list })
}

export function useInvitations() {
  return useQuery({ queryKey: invitationsQueryKey, queryFn: membersApi.listInvitations })
}
