import { ArrowLeft, Mail, Pencil, Phone } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/auth/session-context'
import { errorMessage } from '@/lib/api/api-error'
import { formatPhone } from '@/lib/phone'
import { useContact } from './api'
import { ContactEditDialog } from './contact-edit-dialog'
import { ContactHistory } from './contact-history'
import { ContactNotes } from './contact-notes'
import { LEAD_SOURCE_LABELS } from './lead-source'

const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

/** Ficha do contato: dados e origem, histórico de atendimentos e notas da equipe. */
export function ContactPage() {
  const { id = '' } = useParams()
  const contact = useContact(id)
  const { can } = usePermissions()
  const [editing, setEditing] = useState(false)

  if (contact.isError) {
    return <p className="text-muted-foreground p-6 text-sm">{errorMessage(contact.error)}</p>
  }

  const data = contact.data
  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/contacts">
          <ArrowLeft />
          Contatos
        </Link>
      </Button>

      {data ? (
        <header className="flex flex-wrap items-start gap-4">
          <Avatar className="size-14 text-lg">
            <AvatarFallback>{(data.name ?? '#').slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">{data.name ?? 'Sem nome'}</h1>
            <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {data.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3.5" /> {formatPhone(data.phone)}
                </span>
              )}
              {data.email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-3.5" /> {data.email}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">Origem: {LEAD_SOURCE_LABELS[data.source]}</Badge>
              {data.sourceDetail && <Badge variant="outline">{data.sourceDetail}</Badge>}
              <span className="text-muted-foreground text-xs">
                Contato desde {date.format(new Date(data.createdAt))}
              </span>
            </div>
          </div>
          {can('contacts:edit') && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil />
              Editar
            </Button>
          )}
        </header>
      ) : (
        <Skeleton className="h-20" />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ContactHistory contactId={id} />
        <ContactNotes contactId={id} />
      </div>

      {data && <ContactEditDialog contact={data} open={editing} onOpenChange={setEditing} />}
    </div>
  )
}
