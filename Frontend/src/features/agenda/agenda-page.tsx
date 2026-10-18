import { ChevronLeft, ChevronRight, Globe, Plus, Settings2 } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/auth/session-context'
import { contactLabel } from '@/features/contacts/contact-label'
import { errorMessage } from '@/lib/api/api-error'
import { cn } from '@/lib/utils'
import {
  useAgendaDay,
  useBookingSettings,
  type AgendaDay,
  type AgendaProfessional,
  type DayAppointment,
} from './api'
import { AppointmentDialog, NewAppointmentDialog } from './appointment-dialog'
import { BookingSettingsDialog } from './booking-settings-dialog'
import { addDays, hhmm, isLocalDate, localDateOf, longDate, minutesOf, todayIn } from './time'

/** Altura de uma hora na grade. */
const HOUR_PX = 64
const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const STATUS_STYLES: Record<DayAppointment['status'], string> = {
  // Fundo opaco (bg-card) com a cor por cima: as linhas das horas não atravessam o bloco.
  scheduled:
    'bg-card border-primary text-foreground isolate before:absolute before:inset-0 before:-z-10 before:bg-primary/10 hover:before:bg-primary/15',
  completed: 'bg-success-soft border-success text-foreground',
  no_show: 'bg-warning-soft border-warning text-foreground',
  canceled: 'bg-muted border-border text-muted-foreground line-through opacity-70',
}

/** As horas mostradas: do começo mais cedo ao fim mais tarde do dia (8h–18h no mínimo vazio). */
function visibleHours(day: AgendaDay) {
  const starts: number[] = []
  const ends: number[] = []
  for (const p of day.professionals) {
    for (const r of p.hours) {
      starts.push(r.start)
      ends.push(r.end)
    }
  }
  for (const a of day.appointments) {
    const start = minutesOf(a.startsAt, day.timezone)
    starts.push(start)
    ends.push(Math.max(start + 30, minutesOf(a.endsAt, day.timezone) || 24 * 60))
  }
  const first = starts.length ? Math.floor(Math.min(...starts) / 60) : 8
  const last = ends.length ? Math.ceil(Math.max(...ends) / 60) : 18
  return { first: Math.max(0, first), last: Math.min(24, Math.max(last, first + 1)) }
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function AgendaPage() {
  const { can } = usePermissions()
  const canConfigure = can('catalog:manage')
  const settings = useBookingSettings()
  const timezone = settings.data?.timezone ?? BROWSER_ZONE
  const [params, setParams] = useSearchParams()
  const fromUrl = params.get('date')
  const date = fromUrl && isLocalDate(fromUrl) ? fromUrl : todayIn(timezone)
  const day = useAgendaDay(date)
  const [creating, setCreating] = useState<{ professionalId?: string; minutes?: number } | null>(
    null,
  )
  const [opened, setOpened] = useState<DayAppointment | null>(null)
  const [configuring, setConfiguring] = useState(false)
  const [showCanceled, setShowCanceled] = useState(false)

  const go = (next: string) => setParams(next === todayIn(timezone) ? {} : { date: next })
  const scheduledCount = day.data?.appointments.filter((a) => a.status === 'scheduled').length ?? 0

  return (
    <>
      <PageHeader
        title="Agenda"
        description={longDate(date)}
        actions={
          <>
            {canConfigure && (
              <Button variant="outline" onClick={() => setConfiguring(true)}>
                {settings.data?.enabled ? <Globe /> : <Settings2 />}
                Agendamento online
              </Button>
            )}
            <Button onClick={() => setCreating({})} disabled={!day.data}>
              <Plus />
              Novo agendamento
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Dia anterior"
          onClick={() => go(addDays(date, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button variant="outline" onClick={() => go(todayIn(timezone))}>
          Hoje
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Próximo dia"
          onClick={() => go(addDays(date, 1))}
        >
          <ChevronRight />
        </Button>
        <Input
          type="date"
          aria-label="Ir para o dia"
          className="w-40"
          value={date}
          onChange={(event) => event.target.value && go(event.target.value)}
        />
        <span className="text-muted-foreground text-sm">
          {scheduledCount === 1 ? '1 agendamento' : `${scheduledCount} agendamentos`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Checkbox
            id="show-canceled"
            checked={showCanceled}
            onCheckedChange={(checked) => setShowCanceled(checked === true)}
          />
          <Label htmlFor="show-canceled" className="text-sm font-normal">
            Mostrar cancelados
          </Label>
        </div>
      </div>

      {day.isPending && <Skeleton className="h-96" />}
      {day.isError && <p className="text-destructive text-sm">{errorMessage(day.error)}</p>}
      {day.data && day.data.professionals.length === 0 && (
        <div className="bg-card text-muted-foreground rounded-md border p-8 text-center text-sm">
          A agenda é dos profissionais.{' '}
          {canConfigure ? (
            <>
              <Link to="/professionals" className="text-foreground underline">
                Cadastre quem atende
              </Link>{' '}
              (pode ser você mesmo) e os serviços que cada um faz.
            </>
          ) : (
            'Peça a um administrador para cadastrar os profissionais.'
          )}
        </div>
      )}
      {day.data && day.data.professionals.length > 0 && (
        <DayGrid
          day={day.data}
          showCanceled={showCanceled}
          onCreate={(professionalId, minutes) => setCreating({ professionalId, minutes })}
          onOpen={setOpened}
        />
      )}

      {creating && day.data && (
        <NewAppointmentDialog
          day={day.data}
          professionalId={creating.professionalId}
          minutes={creating.minutes}
          onOpenChange={(open) => !open && setCreating(null)}
        />
      )}
      {opened && day.data && (
        <AppointmentDialog
          key={opened.id}
          day={day.data}
          appointment={opened}
          onOpenChange={(open) => !open && setOpened(null)}
        />
      )}
      {configuring && settings.data && (
        <BookingSettingsDialog
          settings={settings.data}
          onOpenChange={(open) => !open && setConfiguring(false)}
        />
      )}
    </>
  )
}

function DayGrid({
  day,
  showCanceled,
  onCreate,
  onOpen,
}: {
  day: AgendaDay
  showCanceled: boolean
  onCreate: (professionalId: string, minutes: number) => void
  onOpen: (appointment: DayAppointment) => void
}) {
  const now = useNow()
  const { first, last } = visibleHours(day)
  const height = (last - first) * HOUR_PX
  const hours = Array.from({ length: last - first }, (_, i) => first + i)
  const nowMinutes =
    todayIn(day.timezone) === day.date ? minutesOf(now.toISOString(), day.timezone) : null
  const y = (minutes: number) => ((minutes - first * 60) / 60) * HOUR_PX

  return (
    <div className="bg-card overflow-x-auto rounded-md border">
      <div
        className="grid min-w-fit"
        style={{
          gridTemplateColumns: `3.5rem repeat(${day.professionals.length}, minmax(10rem, 1fr))`,
        }}
      >
        <div className="bg-card sticky top-0 z-20 border-b" />
        {day.professionals.map((p) => (
          <div
            key={p.id}
            className="bg-card sticky top-0 z-20 truncate border-b border-l px-2 py-2 text-sm font-medium"
          >
            {p.name}
            {p.hours.length === 0 && (
              <span className="text-faint ml-1 text-xs font-normal">(folga)</span>
            )}
          </div>
        ))}

        <div className="relative" style={{ height }}>
          {hours.map((h) => (
            <span
              key={h}
              className="text-faint absolute right-2 -translate-y-1/2 text-[11px] tabular-nums first:translate-y-0"
              style={{ top: y(h * 60) }}
            >
              {hhmm(h * 60)}
            </span>
          ))}
        </div>
        {day.professionals.map((p) => (
          <ProfessionalColumn
            key={p.id}
            day={day}
            professional={p}
            height={height}
            hours={hours}
            y={y}
            first={first}
            nowMinutes={nowMinutes}
            showCanceled={showCanceled}
            onCreate={onCreate}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
}

function ProfessionalColumn({
  day,
  professional,
  height,
  hours,
  y,
  first,
  nowMinutes,
  showCanceled,
  onCreate,
  onOpen,
}: {
  day: AgendaDay
  professional: AgendaProfessional
  height: number
  hours: number[]
  y: (minutes: number) => number
  first: number
  nowMinutes: number | null
  showCanceled: boolean
  onCreate: (professionalId: string, minutes: number) => void
  onOpen: (appointment: DayAppointment) => void
}) {
  const { timezone } = day
  const appointments = day.appointments.filter(
    (a) => a.professionalId === professional.id && (showCanceled || a.status !== 'canceled'),
  )
  const timeOffs = day.timeOffs.filter((t) => t.professionalId === professional.id)
  // Começa ou termina em outro dia: corta na borda do dia.
  const span = (startsAt: string, endsAt: string) => ({
    start: localDateOf(startsAt, timezone) < day.date ? 0 : minutesOf(startsAt, timezone),
    end: localDateOf(endsAt, timezone) > day.date ? 24 * 60 : minutesOf(endsAt, timezone),
  })

  const clickEmpty = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !professional.active) return
    const offset = event.clientY - event.currentTarget.getBoundingClientRect().top
    const minutes = first * 60 + Math.floor(((offset / HOUR_PX) * 60) / 15) * 15
    onCreate(professional.id, minutes)
  }

  return (
    <div
      className={cn('bg-muted/60 relative border-l', professional.active && 'cursor-copy')}
      style={{ height }}
      onClick={clickEmpty}
      title={professional.active ? `Clique para marcar com ${professional.name}` : undefined}
    >
      {professional.hours.map((r) => (
        <div
          key={r.start}
          className="bg-card pointer-events-none absolute inset-x-0"
          style={{ top: y(r.start), height: y(r.end) - y(r.start) }}
        />
      ))}
      {hours.map((h) => (
        <div
          key={h}
          className="border-border/70 pointer-events-none absolute inset-x-0 border-t"
          style={{ top: y(h * 60) }}
        />
      ))}
      {timeOffs.map((t) => {
        const { start, end } = span(t.startsAt, t.endsAt)
        return (
          <div
            key={t.id}
            className="bg-destructive-soft text-destructive pointer-events-none absolute inset-x-1 overflow-hidden rounded-sm px-1.5 py-0.5 text-[11px]"
            style={{
              top: y(Math.max(start, first * 60)),
              height: y(end) - y(Math.max(start, first * 60)),
            }}
          >
            Bloqueado{t.reason ? ` · ${t.reason}` : ''}
          </div>
        )
      })}
      {appointments.map((a) => {
        const { start, end } = span(a.startsAt, a.endsAt)
        const top = y(start)
        const blockHeight = Math.max(22, y(end) - top - 2)
        return (
          <button
            key={a.id}
            type="button"
            className={cn(
              'absolute inset-x-1 overflow-hidden rounded-sm border-l-4 px-1.5 py-0.5 text-left text-xs shadow-xs',
              STATUS_STYLES[a.status],
              a.status === 'canceled' ? 'z-0' : 'z-10',
            )}
            style={{ top: top + 1, height: blockHeight }}
            onClick={() => onOpen(a)}
          >
            <span className="flex items-center gap-1 font-medium">
              <span className="tabular-nums">{hhmm(start)}</span>
              <span className="truncate">{contactLabel({ ...a.contact, email: null })}</span>
              {a.source === 'site' && (
                <span role="img" aria-label="Agendado pelo site" title="Agendado pelo site">
                  <Globe className="size-3 shrink-0" />
                </span>
              )}
            </span>
            {blockHeight > 34 && (
              <span className="text-muted-foreground block truncate">{a.serviceName}</span>
            )}
          </button>
        )
      })}
      {nowMinutes !== null && nowMinutes >= first * 60 && (
        <div
          className="bg-destructive pointer-events-none absolute inset-x-0 z-10 h-0.5"
          style={{ top: y(nowMinutes) }}
        />
      )}
    </div>
  )
}
