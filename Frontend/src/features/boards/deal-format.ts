import type { QueryClient } from '@tanstack/react-query'
import { formatPhone } from '@/lib/phone'
import { boardKeys, dealKeys, type DealContact, type DealStatus } from './api'

export const DEAL_STATUS: Record<
  DealStatus,
  { label: string; variant: 'outline' | 'success' | 'destructive' }
> = {
  open: { label: 'Em aberto', variant: 'outline' },
  won: { label: 'Ganho', variant: 'success' },
  lost: { label: 'Perdido', variant: 'destructive' },
}

export function dealContactLabel(contact: DealContact | null): string {
  if (!contact) return 'Contato'
  return contact.name ?? (contact.phone ? formatPhone(contact.phone) : (contact.email ?? 'Contato'))
}

/** "há 5 min", "há 3 h", "há 2 d" — tempo na etapa atual. */
export function since(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  return `há ${Math.floor(hours / 24)} d`
}

/** Negócio mudou: recarrega funis, ficha do contato, chat e detalhe. */
export function refreshDeals(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: boardKeys.allDeals })
  void queryClient.invalidateQueries({ queryKey: dealKeys.all })
}
