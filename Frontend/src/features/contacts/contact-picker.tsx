import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { contactsApi } from './api'
import { contactLabel, type PickedContact } from './contact-label'

/** Busca de contato por nome, telefone ou e-mail. */
export function ContactPicker({
  id,
  value,
  onChange,
}: {
  /** O `id` do campo de busca (para o `<label htmlFor>`). */
  id: string
  value: PickedContact | null
  onChange: (contact: PickedContact | null) => void
}) {
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query.trim())
  const results = useQuery({
    queryKey: ['contacts', 'picker', deferred],
    queryFn: () => contactsApi.list({ q: deferred }),
    enabled: deferred.length >= 2,
    staleTime: 30_000,
  })

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
        <span className="truncate font-medium">{contactLabel(value)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Trocar contato"
          onClick={() => onChange(null)}
        >
          <X />
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search className="text-faint pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          id={id}
          autoFocus
          className="pl-8"
          value={query}
          placeholder="Nome, telefone ou e-mail"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {deferred.length >= 2 && (
        <ul
          className="max-h-48 overflow-y-auto rounded-md border"
          aria-label="Contatos encontrados"
        >
          {results.isPending && <li className="text-muted-foreground p-2 text-sm">Buscando…</li>}
          {results.data?.items.length === 0 && (
            <li className="text-muted-foreground p-2 text-sm">Nenhum contato com esse nome.</li>
          )}
          {results.data?.items.slice(0, 8).map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                className="hover:bg-accent w-full px-3 py-1.5 text-left text-sm"
                onClick={() => onChange(contact)}
              >
                {contactLabel(contact)}
                {contact.name && contact.phone && (
                  <span className="text-faint ml-2 text-xs">{contact.phone}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
