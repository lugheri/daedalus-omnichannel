import { Plus, Search, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/features/auth/session-context'
import { formatPhone } from '@/lib/phone'
import { useContacts, type LeadSource } from './api'
import { ContactFormDialog } from './contact-form-dialog'
import { ImportDialog } from './import-dialog'
import { LEAD_SOURCE_LABELS, LEAD_SOURCES } from './lead-source'

const ALL = 'all'

export function ContactsPage() {
  const { can } = usePermissions()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const source = (params.get('source') as LeadSource | null) ?? undefined
  const contacts = useContacts({ q, source })
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState(q)
  const rows = contacts.data?.pages.flatMap((page) => page.items) ?? []

  // Busca vai para a URL depois de uma pausa na digitação (link compartilhável).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() === q) return
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (search.trim()) next.set('q', search.trim())
          else next.delete('q')
          return next
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [search, q, setParams])

  const changeSource = (value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value === ALL) next.delete('source')
      else next.set('source', value)
      return next
    })

  return (
    <>
      <PageHeader
        title="Contatos"
        description="Pessoas com quem sua empresa conversa, em qualquer canal."
        actions={
          can('contacts:edit') && (
            <>
              <Button variant="outline" onClick={() => setImporting(true)}>
                <Upload />
                Importar planilha
              </Button>
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Novo contato
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            aria-label="Buscar contatos"
            placeholder="Buscar por nome, e-mail ou telefone"
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={source ?? ALL} onValueChange={changeSource}>
          <SelectTrigger className="sm:w-56" aria-label="Filtrar por origem">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as origens</SelectItem>
            {LEAD_SOURCES.map((value) => (
              <SelectItem key={value} value={value}>
                {LEAD_SOURCE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="hidden md:table-cell">E-mail</TableHead>
              <TableHead>Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.isPending && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {!contacts.isPending && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                  {q || source ? 'Nenhum contato encontrado.' : 'Nenhum contato ainda.'}
                </TableCell>
              </TableRow>
            )}
            {rows.map((contact) => (
              <TableRow
                key={contact.id}
                className="cursor-pointer"
                onClick={() => navigate(`/contacts/${contact.id}`)}
              >
                <TableCell className="font-medium">
                  {/* Link de verdade: acessível por teclado e abre em nova aba. */}
                  <Link to={`/contacts/${contact.id}`} className="hover:underline">
                    {contact.name ?? <span className="text-muted-foreground">Sem nome</span>}
                  </Link>
                </TableCell>
                <TableCell>{contact.phone ? formatPhone(contact.phone) : '—'}</TableCell>
                <TableCell className="hidden md:table-cell">{contact.email ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline">{LEAD_SOURCE_LABELS[contact.source]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {contacts.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={contacts.isFetchingNextPage}
            onClick={() => void contacts.fetchNextPage()}
          >
            {contacts.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
          </Button>
        </div>
      )}

      <ContactFormDialog open={creating} onOpenChange={setCreating} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </>
  )
}
