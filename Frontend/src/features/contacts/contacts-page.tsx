import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
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
import { useContacts } from './api'
import { ContactFormDialog } from './contact-form-dialog'

export function ContactsPage() {
  const contacts = useContacts()
  const { can } = usePermissions()
  const [creating, setCreating] = useState(false)
  const rows = contacts.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <>
      <PageHeader
        title="Contatos"
        description="Pessoas com quem sua empresa conversa, em qualquer canal."
        actions={
          can('contacts:edit') && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Novo contato
            </Button>
          )
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.isPending && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {!contacts.isPending && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                  Nenhum contato ainda.
                </TableCell>
              </TableRow>
            )}
            {rows.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">
                  {contact.name ?? <span className="text-muted-foreground">Sem nome</span>}
                </TableCell>
                <TableCell>{contact.phone ?? '—'}</TableCell>
                <TableCell>{contact.email ?? '—'}</TableCell>
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
    </>
  )
}
