import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '@/lib/api/client'

/** Espelho de DISPOSITION_COLORS no backend. */
export const DISPOSITION_COLORS = [
  'gray',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
] as const
export type DispositionColor = (typeof DISPOSITION_COLORS)[number]

export interface Disposition {
  id: string
  name: string
  color: DispositionColor
  /** Arquivada: fora das opções, mas o nome continua no histórico. */
  archived: boolean
  createdAt: string
}

export const dispositionsApi = {
  /** Todas, inclusive as arquivadas (aberto a todo membro). */
  list: () => api<Disposition[]>('/v1/dispositions'),
  create: (input: { name: string; color: DispositionColor }) =>
    api<Disposition>('/v1/dispositions', { method: 'POST', body: input }),
  update: (id: string, input: { name?: string; color?: DispositionColor; archived?: boolean }) =>
    api<Disposition>(`/v1/dispositions/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => api<void>(`/v1/dispositions/${id}`, { method: 'DELETE' }),
}

export const dispositionsQueryKey = ['dispositions'] as const

export function useDispositions() {
  return useQuery({
    queryKey: dispositionsQueryKey,
    queryFn: dispositionsApi.list,
    staleTime: 60_000,
  })
}

/** Busca por id (para mostrar a tabulação de uma conversa). */
export function useDispositionLookup(): (id: string | null) => Disposition | undefined {
  const { data } = useDispositions()
  return useCallback((id) => (id ? data?.find((d) => d.id === id) : undefined), [data])
}
