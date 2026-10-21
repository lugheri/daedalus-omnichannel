import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/api-error'
import {
  agendaApi,
  agendaKeys,
  useProfessionalSchedule,
  type ProfessionalSchedule,
  type WeeklyHours,
} from './api'
import { addDays, hhmm, parseHhmm, timeOffLabel, todayIn, WEEKDAYS, zonedIso } from './time'

/** Segunda primeiro, domingo no fim (como o comércio pensa a semana). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const MAX_RANGES = 6

interface RangeText {
  start: string
  end: string
}

/** Horário semanal e bloqueios (férias, folgas, consultas) de um profissional. */
export function ScheduleDialog({
  professional,
  onOpenChange,
}: {
  professional: { id: string; name: string }
  onOpenChange: (open: boolean) => void
}) {
  const schedule = useProfessionalSchedule(professional.id)
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Horários: {professional.name}</DialogTitle>
          <DialogDescription>
            Os horários livres da agenda (e do site) saem daqui, descontando agendamentos e
            bloqueios.
          </DialogDescription>
        </DialogHeader>
        {schedule.isPending && <Skeleton className="h-80" />}
        {schedule.isError && (
          <p className="text-destructive text-sm">{errorMessage(schedule.error)}</p>
        )}
        {schedule.data && (
          <ScheduleForm
            professionalId={professional.id}
            schedule={schedule.data}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ScheduleForm({
  professionalId,
  schedule,
  onClose,
}: {
  professionalId: string
  schedule: ProfessionalSchedule
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [week, setWeek] = useState<RangeText[][]>(() =>
    schedule.weekly.map((day) => day.map((r) => ({ start: hhmm(r.start), end: hhmm(r.end) }))),
  )
  const parsed = toWeekly(week)

  const save = useMutation({
    mutationFn: (weekly: WeeklyHours) => agendaApi.saveSchedule(professionalId, weekly),
    onSuccess: () => {
      toast.success('Horários salvos.')
      void queryClient.invalidateQueries({ queryKey: agendaKeys.all })
      onClose()
    },
  })

  const setDay = (weekday: number, ranges: RangeText[]) =>
    setWeek((current) => current.map((day, i) => (i === weekday ? ranges : day)))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (parsed) save.mutate(parsed)
  }

  return (
    <>
      <form id="schedule-form" onSubmit={submit}>
        <FieldGroup>
          <FormError error={save.error} />
          {schedule.isDefault && (
            <p className="text-muted-foreground text-sm">
              Ainda no horário padrão (seg a sex 9h–12h e 13h–18h, sáb 9h–13h). Ajuste e salve.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {DAY_ORDER.map((weekday) => (
              <DayRow
                key={weekday}
                weekday={weekday}
                ranges={week[weekday]}
                onChange={(ranges) => setDay(weekday, ranges)}
              />
            ))}
          </div>
          {!parsed && (
            <p className="text-destructive text-sm">
              Confira os horários: o fim vem depois do começo, e os intervalos de um dia não se
              cruzam.
            </p>
          )}
          <p className="text-muted-foreground text-xs">Horário de {schedule.timezone}.</p>
        </FieldGroup>
      </form>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button type="submit" form="schedule-form" disabled={!parsed || save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar horários'}
        </Button>
      </div>

      <Separator />
      <TimeOffs professionalId={professionalId} schedule={schedule} />
    </>
  )
}

function DayRow({
  weekday,
  ranges,
  onChange,
}: {
  weekday: number
  ranges: RangeText[]
  onChange: (ranges: RangeText[]) => void
}) {
  const open = ranges.length > 0
  const id = `day-${weekday}`
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md border px-3 py-2">
      <div className="flex w-28 items-center gap-2 pt-1.5">
        <Checkbox
          id={id}
          checked={open}
          onCheckedChange={(checked) =>
            onChange(checked === true ? [{ start: '09:00', end: '18:00' }] : [])
          }
        />
        <Label htmlFor={id}>{WEEKDAYS[weekday]}</Label>
      </div>
      {!open && <span className="text-muted-foreground pt-1.5 text-sm">Fechado</span>}
      {open && (
        <div className="flex flex-1 flex-col gap-1.5">
          {ranges.map((range, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                type="time"
                step={300}
                aria-label={`${WEEKDAYS[weekday]}: início do intervalo ${i + 1}`}
                className="w-28"
                value={range.start}
                onChange={(event) =>
                  onChange(
                    ranges.map((r, j) => (j === i ? { ...r, start: event.target.value } : r)),
                  )
                }
              />
              <span className="text-muted-foreground text-sm">às</span>
              <Input
                type="time"
                step={300}
                aria-label={`${WEEKDAYS[weekday]}: fim do intervalo ${i + 1}`}
                className="w-28"
                value={range.end}
                onChange={(event) =>
                  onChange(ranges.map((r, j) => (j === i ? { ...r, end: event.target.value } : r)))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Remover intervalo"
                onClick={() => onChange(ranges.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
              {i === ranges.length - 1 && ranges.length < MAX_RANGES && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Adicionar intervalo em ${WEEKDAYS[weekday]}`}
                  onClick={() => onChange([...ranges, nextRange(range)])}
                >
                  <Plus />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Um intervalo depois do último (ex.: volta do almoço). */
function nextRange(last: RangeText): RangeText {
  const end = parseHhmm(last.end) ?? 12 * 60
  const start = Math.min(end + 60, 22 * 60)
  return { start: hhmm(start), end: hhmm(Math.min(start + 4 * 60, 23 * 60 + 55)) }
}

/** O texto vira minutos; null se algo não fecha (o backend valida de novo). */
function toWeekly(week: RangeText[][]): WeeklyHours | null {
  const weekly: WeeklyHours = []
  for (const day of week) {
    const ranges = day
      .map((r) => ({ start: parseHhmm(r.start), end: parseHhmm(r.end) }))
      .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
    for (let i = 0; i < ranges.length; i++) {
      const { start, end } = ranges[i]
      if (start === null || end === null || end <= start || start % 5 || end % 5) return null
      if (i > 0 && start < (ranges[i - 1].end ?? 0)) return null
    }
    weekly.push(ranges as WeeklyHours[number])
  }
  return weekly
}

function TimeOffs({
  professionalId,
  schedule,
}: {
  professionalId: string
  schedule: ProfessionalSchedule
}) {
  const queryClient = useQueryClient()
  const { timezone } = schedule
  const today = todayIn(timezone)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [wholeDay, setWholeDay] = useState(true)
  const [startTime, setStartTime] = useState('12:00')
  const [endTime, setEndTime] = useState('13:00')
  const [reason, setReason] = useState('')
  const refresh = () => queryClient.invalidateQueries({ queryKey: agendaKeys.all })

  const add = useMutation({
    mutationFn: () => {
      const startsAt = wholeDay
        ? zonedIso(from, 0, timezone)
        : zonedIso(from, parseHhmm(startTime) ?? 0, timezone)
      const endsAt = wholeDay
        ? zonedIso(addDays(to, 1), 0, timezone)
        : zonedIso(to, parseHhmm(endTime) ?? 0, timezone)
      return agendaApi.addTimeOff(professionalId, {
        startsAt,
        endsAt,
        reason: reason.trim() || null,
      })
    },
    onSuccess: () => {
      toast.success('Bloqueio criado.')
      setReason('')
      void refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => agendaApi.removeTimeOff(id),
    onSuccess: () => {
      toast.success('Bloqueio removido.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    add.mutate()
  }

  return (
    <section aria-labelledby="time-offs-title" className="flex flex-col gap-3">
      <div>
        <h3 id="time-offs-title" className="font-medium">
          Bloqueios
        </h3>
        <p className="text-muted-foreground text-sm">
          Férias, folgas e compromissos: ninguém marca nesses horários pelo site.
        </p>
      </div>
      {schedule.timeOffs.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Bloqueios marcados">
          {schedule.timeOffs.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
            >
              <span>
                {timeOffLabel(t, timezone)}
                {t.reason && <span className="text-muted-foreground"> · {t.reason}</span>}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Remover bloqueio"
                disabled={remove.isPending}
                onClick={() => remove.mutate(t.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-md border p-3">
        <FormError error={add.error} />
        <div className="flex items-center gap-2">
          <Checkbox
            id="time-off-whole"
            checked={wholeDay}
            onCheckedChange={(checked) => setWholeDay(checked === true)}
          />
          <Label htmlFor="time-off-whole">Dia inteiro</Label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="time-off-from">De</FieldLabel>
            <div className="flex gap-1.5">
              <Input
                id="time-off-from"
                type="date"
                value={from}
                onChange={(event) => {
                  if (!event.target.value) return
                  setFrom(event.target.value)
                  if (to < event.target.value) setTo(event.target.value)
                }}
              />
              {!wholeDay && (
                <Input
                  type="time"
                  step={300}
                  aria-label="Hora do início"
                  className="w-28"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              )}
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="time-off-to">Até</FieldLabel>
            <div className="flex gap-1.5">
              <Input
                id="time-off-to"
                type="date"
                value={to}
                min={from}
                onChange={(event) => event.target.value && setTo(event.target.value)}
              />
              {!wholeDay && (
                <Input
                  type="time"
                  step={300}
                  aria-label="Hora do fim"
                  className="w-28"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              )}
            </div>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="time-off-reason">Motivo (opcional)</FieldLabel>
          <Input
            id="time-off-reason"
            maxLength={200}
            value={reason}
            placeholder="Férias, curso, médico…"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="outline" disabled={add.isPending}>
            <Plus />
            Bloquear
          </Button>
        </div>
      </form>
    </section>
  )
}
