import { ClipboardList } from 'lucide-react'
import { usePermissions } from '@/features/auth/session-context'
import { useContactSubmissions } from './api'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** O que o contato mandou pelos formulários do site (ficha). Some se não houver nada. */
export function ContactSubmissions({ contactId }: { contactId: string }) {
  const { can } = usePermissions()
  const submissions = useContactSubmissions(contactId, can('contacts:view'))
  if (!submissions.data?.length) return null

  return (
    <section aria-labelledby="submissions-title" className="flex flex-col gap-3">
      <h2 id="submissions-title" className="font-semibold">
        Formulários enviados
      </h2>
      <ul className="flex flex-col gap-2">
        {submissions.data.map((s) => (
          <li key={s.id} className="flex gap-3 rounded-md border p-3">
            <ClipboardList className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate font-medium">{s.formName}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {dateTime.format(new Date(s.createdAt))}
                </span>
              </div>
              {s.serviceName && (
                <p>
                  Serviço: {s.serviceName}
                  {s.preferredDate && ` · prefere ${s.preferredDate}`}
                </p>
              )}
              {s.message && (
                <p className="text-muted-foreground whitespace-pre-line">{s.message}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
