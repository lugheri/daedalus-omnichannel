import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export interface Contact {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  createdAt: string
}

interface ContactsPage {
  items: Contact[]
  nextCursor: string | null
}

export const contactsApi = {
  list: (cursor?: string) => api<ContactsPage>('/v1/contacts', { query: { limit: 25, cursor } }),
  create: (input: { name?: string; phone?: string; email?: string }) =>
    api<Contact>('/v1/contacts', { method: 'POST', body: input }),
}

export const contactsQueryKey = ['contacts'] as const

/** Paginação por cursor: cada página traz o cursor da próxima. */
export function useContacts() {
  return useInfiniteQuery({
    queryKey: contactsQueryKey,
    queryFn: ({ pageParam }) => contactsApi.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}
