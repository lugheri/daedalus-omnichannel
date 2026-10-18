import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CircleSlash, ExternalLink, Globe, RotateCcw, UserX } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDuration, formatPrice } from '@/features/catalog/format'
import { ContactPicker } from '@/features/contacts/contact-picker'
import { contactLabel, type PickedContact } from '@/features/contacts/contact-label'
import {
  agendaApi,
  agendaKeys,
  type AgendaDay,
  type AppointmentStatus,
  type DayAppointment,
} from './api'
import {
  hhmm,
  localDateOf,
  longDate,
  parseHhmm,
  STATUS_LABELS,
  STATUS_VARIANTS,
  timeIn,
  zonedIso,
} from './time'

const ANYONE = 'anyone'

/** Sugestões de horário livre (no horário de cada profissional), a partir de agora. */
function SlotSuggestions({
  serviceId,
  professionalId,
  date,
  timezone,
  selected,
  onPick,
}: {
  serviceId: string
  professionalId: string | null
  date: string
  timezone: string
  selected: string
  onPick: (time: string, professionalId: string) => void
}) {
  const slots = useQuery({
    queryKey: agendaKeys.slots(serviceId, professionalId, date),
    queryFn: () => agendaApi.slots({ serviceId, professionalId, date }),
    staleTime: 15_000,
  })
  if (slots.isPending) return <p className="text-muted-foreground text-xs">Buscando horários…</p>
  if (!slots.data?.length) {
    return (
      <p className="text-muted-foreground text-xs">
        Nenhum horário livre neste dia. Você ainda pode marcar digitando a hora.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Horários livres">
      {slots.data.map((slot) => {
        const time = timeIn(slot.startsAt, timezone)
        return (
          <Button
            key={slot.startsAt}
            type="button"
            size="sm"
            variant={time === selected ? 'default' : 'outline'}
            className="h-7 px-2 tabular-nums"
            onClick={() => onPick(time, slot.professionalIds[0])}
          >
            {time}
          </Button>
        )
      })}
    </div>
  )
}

/**
 * Novo agendamento. O painel pode marcar fora do horário (encaixe); as
 * sugestões mostram só os horários livres de verdade.
 */
export function NewAppointmentDialog({
  day,
  professionalId: initialProfessional,
  minutes,
  onOpenChange,
}: {
  day: AgendaDay
  professionalId?: string
  minutes?: number
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { timezone } = day
  const [contact, setContact] = useState<PickedContact | null>(null)
  const services = day.services.filter((s) => s.active)
  const [serviceId, setServiceId] = useState(() => {
    const offered = initialProfessional
      ? day.professionals.find((p) => p.id === initialProfessional)?.offeringIds
      : undefined
    return (offered ? services.find((s) => offered.includes(s.id)) : services[0])?.id ?? ''
  })
  const [professionalId, setProfessionalId] = useState(initialProfessional ?? ANYONE)
  const [date, setDate] = useState(day.date)
  const [time, setTime] = useState(minutes !== undefined ? hhmm(minutes) : '')
  const [notes, setNotes] = useState('')
  const service = services.find((s) => s.id === serviceId)
  const pros = day.professionals.filter((p) => p.active && p.offeringIds.includes(serviceId))
  const chosen = professionalId === ANYONE ? null : professionalId
  const minutesValue = parseHhmm(time)

  const create = useMutation({
    mutationFn: () =>
      agendaApi.book({
        professionalId: chosen!,
        serviceId,
        contactId: contact!.id,
        startsAt: zonedIso(date, minutesValue!, timezone),
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Agendamento marcado.')
      void queryClient.invalidateQueries({ queryKey: agendaKeys.all })
      onOpenChange(false)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!contact || !chosen || minutesValue === null || !service) return
    create.mutate()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            Escolha um horário livre ou digite a hora (encaixe fora do horário também vale).
          </DialogDescription>
        </DialogHeader>
        <form id="appointment-form" onSubmit={submit}>
          <FieldGroup>
            <FormError error={create.error} />
            <Field>
              <FieldLabel htmlFor="appointment-contact">Cliente</FieldLabel>
              <ContactPicker id="appointment-contact" value={contact} onChange={setContact} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="appointment-service">Serviço</FieldLabel>
                <Select
                  value={serviceId}
                  onValueChange={(value) => {
                    setServiceId(value)
                    const stillDoes = day.professionals
                      .find((p) => p.id === professionalId)
                      ?.offeringIds.includes(value)
                    if (!stillDoes) setProfessionalId(ANYONE)
                  }}
                >
                  <SelectTrigger id="appointment-service" className="w-full">
                    <SelectValue placeholder="Escolha…" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {formatDuration(s.durationMinutes)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="appointment-professional">Profissional</FieldLabel>
                <Select value={professionalId} onValueChange={setProfessionalId}>
                  <SelectTrigger id="appointment-professional" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANYONE}>Qualquer um (pelo horário)</SelectItem>
                    {pros.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="appointment-date">Dia</FieldLabel>
                <Input
                  id="appointment-date"
                  type="date"
                  value={date}
                  required
                  onChange={(event) => event.target.value && setDate(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="appointment-time">Hora</FieldLabel>
                <Input
                  id="appointment-time"
                  type="time"
                  step={300}
                  value={time}
                  required
                  onChange={(event) => setTime(event.target.value)}
                />
              </Field>
            </div>
            {service && (
              <Field>
                <p className="text-sm font-medium">Horários livres</p>
                <SlotSuggestions
                  serviceId={service.id}
                  professionalId={chosen}
                  date={date}
                  timezone={timezone}
                  selected={time}
                  onPick={(picked, proId) => {
                    setTime(picked)
                    if (!chosen) setProfessionalId(proId)
                  }}
                />
                {!chosen && minutesValue !== null && (
                  <FieldDescription>Escolha o profissional (ou um horário livre).</FieldDescription>
                )}
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="appointment-notes">Observações</FieldLabel>
              <Textarea
                id="appointment-notes"
                rows={2}
                maxLength={1000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="appointment-form"
            disabled={!contact || !chosen || minutesValue === null || !service || create.isPending}
          >
            {create.isPending ? 'Marcando…' : 'Marcar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Um agendamento: remarcar, trocar o profissional, observações e situação. */
export function AppointmentDialog({
  day,
  appointment,
  onOpenChange,
}: {
  day: AgendaDay
  appointment: DayAppointment
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { timezone } = day
  const [date, setDate] = useState(localDateOf(appointment.startsAt, timezone))
  const [time, setTime] = useState(timeIn(appointment.startsAt, timezone))
  const [professionalId, setProfessionalId] = useState(appointment.professionalId)
  const [notes, setNotes] = useState(appointment.notes ?? '')
  const [canceling, setCanceling] = useState(false)
  const [reason, setReason] = useState('')
  const scheduled = appointment.status === 'scheduled'
  const service = day.services.find((s) => s.id === appointment.serviceId)
  const pros = day.professionals.filter(
    (p) =>
      p.id === appointment.professionalId ||
      (p.active && p.offeringIds.includes(appointment.serviceId)),
  )
  const minutesValue = parseHhmm(time)
  const startsAt = minutesValue === null ? null : zonedIso(date, minutesValue, timezone)
  const changes = {
    ...(startsAt && startsAt !== new Date(appointment.startsAt).toISOString() ? { startsAt } : {}),
    ...(professionalId !== appointment.professionalId ? { professionalId } : {}),
    ...(notes.trim() !== (appointment.notes ?? '') ? { notes: notes.trim() || null } : {}),
  }
  const dirty = Object.keys(changes).length > 0

  const done = (message: string) => {
    toast.success(message)
    void queryClient.invalidateQueries({ queryKey: agendaKeys.all })
    onOpenChange(false)
  }
  const save = useMutation({
    mutationFn: () => agendaApi.update(appointment.id, changes),
    onSuccess: () => done('Agendamento atualizado.'),
  })
  const status = useMutation({
    mutationFn: (next: { status: AppointmentStatus; reason?: string | null }) =>
      agendaApi.setStatus(appointment.id, next.status, next.reason ?? null),
    onSuccess: (result) => done(`Agendamento: ${STATUS_LABELS[result.status].toLowerCase()}.`),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (dirty && minutesValue !== null) save.mutate()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {appointment.serviceName}
            <Badge variant={STATUS_VARIANTS[appointment.status]}>
              {STATUS_LABELS[appointment.status]}
            </Badge>
            {appointment.source === 'site' && (
              <Badge variant="outline">
                <Globe />
                Pelo site
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {longDate(localDateOf(appointment.startsAt, timezone))},{' '}
            {timeIn(appointment.startsAt, timezone)} às {timeIn(appointment.endsAt, timezone)}
            {appointment.priceCents !== null && ` · ${formatPrice(appointment.priceCents)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {contactLabel({ ...appointment.contact, email: null })}
            </p>
            {appointment.contact.name && appointment.contact.phone && (
              <p className="text-muted-foreground text-xs">{appointment.contact.phone}</p>
            )}
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/contacts/${appointment.contactId}`}>
              <ExternalLink />
              Ficha
            </Link>
          </Button>
        </div>

        <form id="appointment-edit" onSubmit={submit}>
          <FieldGroup>
            <FormError error={save.error ?? status.error} />
            {appointment.cancelReason && (
              <p className="text-muted-foreground text-sm">
                Motivo do cancelamento: {appointment.cancelReason}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="edit-date">Dia</FieldLabel>
                <Input
                  id="edit-date"
                  type="date"
                  value={date}
                  disabled={!scheduled}
                  onChange={(event) => event.target.value && setDate(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-time">Hora</FieldLabel>
                <Input
                  id="edit-time"
                  type="time"
                  step={300}
                  value={time}
                  disabled={!scheduled}
                  onChange={(event) => setTime(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-professional">Profissional</FieldLabel>
                <Select
                  value={professionalId}
                  onValueChange={setProfessionalId}
                  disabled={!scheduled}
                >
                  <SelectTrigger id="edit-professional" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pros.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {scheduled && service && minutesValue !== null && (
              <FieldDescription>
                Termina às {hhmm((minutesValue + service.durationMinutes) % (24 * 60))} (
                {formatDuration(service.durationMinutes)}).
              </FieldDescription>
            )}
            <Field>
              <FieldLabel htmlFor="edit-notes">Observações</FieldLabel>
              <Textarea
                id="edit-notes"
                rows={2}
                maxLength={1000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
            {canceling && (
              <Field>
                <FieldLabel htmlFor="cancel-reason">Motivo do cancelamento (opcional)</FieldLabel>
                <Input
                  id="cancel-reason"
                  autoFocus
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            )}
          </FieldGroup>
        </form>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {scheduled && !canceling && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={status.isPending}
                  onClick={() => status.mutate({ status: 'completed' })}
                >
                  <CalendarCheck />
                  Concluído
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={status.isPending}
                  onClick={() => status.mutate({ status: 'no_show' })}
                >
                  <UserX />
                  Faltou
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCanceling(true)}>
                  <CircleSlash />
                  Cancelar…
                </Button>
              </>
            )}
            {canceling && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={status.isPending}
                  onClick={() =>
                    status.mutate({ status: 'canceled', reason: reason.trim() || null })
                  }
                >
                  Confirmar cancelamento
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCanceling(false)}>
                  Voltar
                </Button>
              </>
            )}
            {!scheduled && (
              <Button
                variant="outline"
                size="sm"
                disabled={status.isPending}
                onClick={() => status.mutate({ status: 'scheduled' })}
              >
                <RotateCcw />
                Voltar para agendado
              </Button>
            )}
          </div>
          <Button
            type="submit"
            form="appointment-edit"
            disabled={!dirty || minutesValue === null || save.isPending}
          >
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
