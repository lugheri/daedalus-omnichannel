import { useQuery } from '@tanstack/react-query'
import type { Tenant } from '@/features/auth/api'
import { api } from '@/lib/api/client'

/** Uma conta abaixo da atual (filha, neta...). */
export interface ChildAccount extends Tenant {
  parentId: string | null
  parentName: string | null
  /** 1 = filha direta; 2 = neta... */
  depth: number
  /** Plano escolhido (null = o padrão). */
  planId: string | null
  planName: string | null
  createdAt: string
}

export interface ParentAccess {
  createdAt: string
  userName: string
  fromAccountName: string
}

export const accountsApi = {
  children: () => api<ChildAccount[]>('/v1/accounts/children'),
  create: (input: {
    accountName: string
    ownerEmail: string
    allowsChildren: boolean
    planId: string | null
  }) =>
    api<{ account: Tenant; inviteUrl: string }>('/v1/accounts/children', {
      method: 'POST',
      body: input,
    }),
  suspend: (id: string) => api<Tenant>(`/v1/accounts/children/${id}/suspend`, { method: 'POST' }),
  reactivate: (id: string) =>
    api<Tenant>(`/v1/accounts/children/${id}/reactivate`, { method: 'POST' }),
  /** Revendedor: pode criar contas abaixo. */
  setReseller: (id: string, allowsChildren: boolean) =>
    api<Tenant>(`/v1/accounts/children/${id}`, { method: 'PATCH', body: { allowsChildren } }),
  /** Troca o plano (null = o padrão). */
  setPlan: (id: string, planId: string | null) =>
    api<Tenant>(`/v1/accounts/children/${id}/plan`, { method: 'PUT', body: { planId } }),
  /** Quem de uma conta acima entrou nesta. */
  parentAccesses: () => api<ParentAccess[]>('/v1/accounts/parent-accesses'),
}

export const accountKeys = {
  all: ['accounts'] as const,
  children: ['accounts', 'children'] as const,
  parentAccesses: ['accounts', 'parent-accesses'] as const,
}

export function useChildAccounts() {
  return useQuery({ queryKey: accountKeys.children, queryFn: accountsApi.children })
}

export function useParentAccesses(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.parentAccesses,
    queryFn: accountsApi.parentAccesses,
    enabled,
  })
}
