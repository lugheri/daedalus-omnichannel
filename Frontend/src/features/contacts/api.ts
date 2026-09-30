import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export type LeadSource = 'whatsapp' | 'manual' | 'import' | 'web_form'

export interface Contact {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  /** De onde o contato veio (não editável: é histórico). */
  source: LeadSource
  sourceDetail: string | null
  createdAt: string
  updatedAt: string
}

export interface ContactNote {
  id: string
  body: string
  authorMembershipId: string
  createdAt: string
}

interface ContactsPage {
  items: Contact[]
  nextCursor: string | null
}

export interface ContactFilters {
  q?: string
  source?: LeadSource
}

export const contactsApi = {
  list: (filters: ContactFilters, cursor?: string) =>
    api<ContactsPage>('/v1/contacts', {
      query: { limit: 25, cursor, q: filters.q || undefined, source: filters.source },
    }),
  get: (id: string) => api<Contact>(`/v1/contacts/${id}`),
  create: (input: { name?: string; phone?: string; email?: string; sourceDetail?: string }) =>
    api<Contact>('/v1/contacts', { method: 'POST', body: input }),
  /** Campo ausente = não muda; null = apaga. */
  update: (
    id: string,
    input: { name?: string | null; phone?: string | null; email?: string | null },
  ) => api<Contact>(`/v1/contacts/${id}`, { method: 'PATCH', body: input }),
  notes: (id: string) => api<ContactNote[]>(`/v1/contacts/${id}/notes`),
  addNote: (id: string, body: string) =>
    api<ContactNote>(`/v1/contacts/${id}/notes`, { method: 'POST', body: { body } }),
  deleteNote: (id: string, noteId: string) =>
    api<void>(`/v1/contacts/${id}/notes/${noteId}`, { method: 'DELETE' }),
  /** O rótulo vai antes do arquivo: o servidor lê o multipart em ordem. */
  importCsv: (file: File, label: string) => {
    const form = new FormData()
    if (label.trim()) form.append('label', label.trim())
    form.append('file', file)
    return api<ImportReport>('/v1/contacts/import', { method: 'POST', body: form })
  },
}

export interface ImportReport {
  total: number
  created: number
  duplicates: number
  /** line = linha da planilha (a 1 é o cabeçalho). */
  errors: { line: number; code: string }[]
}

export const contactsQueryKey = ['contacts'] as const
export const contactKeys = {
  list: (filters: ContactFilters) => ['contacts', 'list', filters] as const,
  detail: (id: string) => ['contacts', 'detail', id] as const,
  notes: (id: string) => ['contacts', 'notes', id] as const,
}

/** Paginação por cursor: cada página traz o cursor da próxima. */
export function useContacts(filters: ContactFilters) {
  return useInfiniteQuery({
    queryKey: contactKeys.list(filters),
    queryFn: ({ pageParam }) => contactsApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function useContact(id: string) {
  return useQuery({ queryKey: contactKeys.detail(id), queryFn: () => contactsApi.get(id) })
}

export function useContactNotes(id: string) {
  return useQuery({ queryKey: contactKeys.notes(id), queryFn: () => contactsApi.notes(id) })
}

export interface SourceDetail {
  source: LeadSource
  detail: string
  count: number
}

/** Detalhes de origem em uso (campanhas do site, lotes de importação). */
export function useSourceDetails() {
  return useQuery({
    queryKey: ['contacts', 'source-details'] as const,
    queryFn: () => api<SourceDetail[]>('/v1/contacts/source-details'),
    staleTime: 60_000,
  })
}
