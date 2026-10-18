import { CalendarDays, Globe } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { usePermissions } from '@/features/auth/session-context'
import { useBookingSettings, useContactAppointments } from './api'
import { dateTimeIn, localDateOf, STATUS_LABELS, STATUS_VARIANTS } from './time'

const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

/** Agendamentos do contato (ficha), os mais recentes primeiro. Some se não houver. */
export function ContactAppointments({ contactId }: { contactId: string }) {
  const { can } = usePermissions()
  const allowed = can('agenda:manage')
  const appointments = useContactAppointments(contactId, allowed)
  const settings = useBookingSettings(allowed)
  if (!appointments.data?.length) return null
  const timezone = settings.data?.timezone ?? BROWSER_ZONE

  return (
    <section aria-labelledby="appointments-title" className="flex flex-col gap-3">
      <h2 id="appointments-title" className="font-semibold">
        Agendamentos
      </h2>
      <ul className="flex flex-col gap-2">
        {appointments.data.map((a) => (
          <li key={a.id} className="flex gap-3 rounded-md border p-3">
            <CalendarDays className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to={`/agenda?date=${localDateOf(a.startsAt, timezone)}`}
                  className="truncate font-medium hover:underline"
                >
                  {a.serviceName}
                </Link>
                <Badge variant={STATUS_VARIANTS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
              </div>
              <p className="text-muted-foreground flex items-center gap-1">
                {dateTimeIn(a.startsAt, timezone)}
                {a.source === 'site' && (
                  <span role="img" aria-label="Agendado pelo site" title="Agendado pelo site">
                    <Globe className="size-3.5" />
                  </span>
                )}
              </p>
              {a.cancelReason && <p className="text-muted-foreground">Motivo: {a.cancelReason}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
