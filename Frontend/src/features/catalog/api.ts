import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export interface Service {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  /** Centavos; null = "sob consulta". */
  priceCents: number | null
  showOnSite: boolean
  /** Inativo: fora das opções novas (agenda, site), continua no histórico. */
  active: boolean
  createdAt: string
}

export interface Professional {
  id: string
  name: string
  title: string | null
  bio: string | null
  /** Membro da conta vinculado (quem tem login), se houver. */
  membershipId: string | null
  serviceIds: string[]
  showOnSite: boolean
  active: boolean
  createdAt: string
}

export type ServiceInput = Pick<
  Service,
  'name' | 'description' | 'durationMinutes' | 'priceCents' | 'showOnSite'
>
export type ProfessionalInput = Pick<
  Professional,
  'name' | 'title' | 'bio' | 'membershipId' | 'serviceIds' | 'showOnSite'
>

export const catalogApi = {
  services: () => api<Service[]>('/v1/catalog/services'),
  createService: (input: ServiceInput) =>
    api<Service>('/v1/catalog/services', { method: 'POST', body: input }),
  updateService: (id: string, input: Partial<ServiceInput> & { active?: boolean }) =>
    api<Service>(`/v1/catalog/services/${id}`, { method: 'PATCH', body: input }),
  removeService: (id: string) => api<void>(`/v1/catalog/services/${id}`, { method: 'DELETE' }),

  professionals: () => api<Professional[]>('/v1/catalog/professionals'),
  createProfessional: (input: ProfessionalInput) =>
    api<Professional>('/v1/catalog/professionals', { method: 'POST', body: input }),
  updateProfessional: (id: string, input: Partial<ProfessionalInput> & { active?: boolean }) =>
    api<Professional>(`/v1/catalog/professionals/${id}`, { method: 'PATCH', body: input }),
  removeProfessional: (id: string) =>
    api<void>(`/v1/catalog/professionals/${id}`, { method: 'DELETE' }),
}

export const catalogKeys = {
  all: ['catalog'] as const,
  services: ['catalog', 'services'] as const,
  professionals: ['catalog', 'professionals'] as const,
}

/** Aberto a todo membro (a agenda e o atendimento usam). */
export function useServices() {
  return useQuery({
    queryKey: catalogKeys.services,
    queryFn: catalogApi.services,
    staleTime: 60_000,
  })
}

export function useProfessionals() {
  return useQuery({
    queryKey: catalogKeys.professionals,
    queryFn: catalogApi.professionals,
    staleTime: 60_000,
  })
}
