import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, RefreshCw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { env } from '@/lib/env'
import { agendaApi, agendaKeys, type BookingSettings } from './api'
import { bookingSnippet, NOTICE_OPTIONS, WINDOW_OPTIONS } from './booking-options'
import { SLOT_STEPS, TIMEZONES } from './time'
import { NOT_IN_PLAN, usePlanFeature } from '@/features/plans/use-plan-feature'

/** Fuso da agenda e agendamento online (o widget no site). */
export function BookingSettingsDialog({
  settings,
  onOpenChange,
}: {
  settings: BookingSettings
  onOpenChange: (open: boolean) => void
}) {
  const canBook = usePlanFeature('onlineBooking')
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(settings.enabled)
  const [timezone, setTimezone] = useState(settings.timezone)
  const [step, setStep] = useState(String(settings.slotStepMinutes))
  const [notice, setNotice] = useState(String(settings.minNoticeMinutes))
  const [daysAhead, setDaysAhead] = useState(String(settings.maxDaysAhead))
  const [publicKey, setPublicKey] = useState(settings.publicKey)
  const zones = TIMEZONES.some((z) => z.value === settings.timezone)
    ? TIMEZONES
    : [...TIMEZONES, { value: settings.timezone, label: settings.timezone }]
  const notices = withCurrent(NOTICE_OPTIONS, settings.minNoticeMinutes)
  const windows = withCurrent(WINDOW_OPTIONS, settings.maxDaysAhead)
  const snippet = publicKey ? bookingSnippet(env.VITE_API_URL, publicKey) : null

  const save = useMutation({
    mutationFn: (rotateKey: boolean) =>
      agendaApi.saveSettings(
        rotateKey
          ? { rotateKey }
          : {
              enabled,
              timezone,
              slotStepMinutes: Number(step),
              minNoticeMinutes: Number(notice),
              maxDaysAhead: Number(daysAhead),
            },
      ),
    onSuccess: (next, rotateKey) => {
      void queryClient.invalidateQueries({ queryKey: agendaKeys.all })
      setPublicKey(next.publicKey)
      if (rotateKey) {
        toast.success(
          'Chave trocada. Cole o código novo nos outros sites (e publique o seu de novo).',
        )
      } else {
        toast.success(next.enabled ? 'Agendamento online ligado.' : 'Configuração salva.')
        onOpenChange(false)
      }
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet ?? '')
      toast.success('Código copiado.')
    } catch {
      toast.error('Não foi possível copiar. Selecione o código e copie à mão.')
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendamento online</DialogTitle>
          <DialogDescription>
            O cliente escolhe serviço, profissional e um horário livre no site, e o horário já fica
            marcado na agenda.
          </DialogDescription>
        </DialogHeader>
        <form id="booking-settings" onSubmit={submit}>
          <FieldGroup>
            <FormError error={save.error} />
            <div className="flex items-start gap-2">
              <Checkbox
                id="booking-enabled"
                checked={enabled}
                // Sem o recurso no plano, dá para desligar mas não ligar.
                disabled={!enabled && !canBook}
                title={!enabled && !canBook ? NOT_IN_PLAN : undefined}
                onCheckedChange={(checked) => setEnabled(checked === true)}
              />
              <div className="grid gap-1">
                <Label htmlFor="booking-enabled">Aceitar agendamentos pelo site</Label>
                <p className="text-muted-foreground text-xs">
                  Só os serviços e profissionais marcados “mostrar no site”, nos horários de cada
                  profissional.
                </p>
              </div>
            </div>
            <Field>
              <FieldLabel htmlFor="booking-timezone">Fuso horário da agenda</FieldLabel>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="booking-timezone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.value} value={z.value}>
                      {z.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Os horários dos profissionais seguem este relógio.
              </FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="booking-step">Horários a cada</FieldLabel>
                <Select value={step} onValueChange={setStep}>
                  <SelectTrigger id="booking-step" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SLOT_STEPS.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s === 60 ? '1 hora' : `${s} min`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="booking-notice">Antecedência mínima</FieldLabel>
                <Select value={notice} onValueChange={setNotice}>
                  <SelectTrigger id="booking-notice" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {notices.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="booking-window">Até quantos dias</FieldLabel>
                <Select value={daysAhead} onValueChange={setDaysAhead}>
                  <SelectTrigger id="booking-window" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {windows.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {snippet && (
              <Field>
                <FieldLabel htmlFor="booking-snippet">Código para colar em outro site</FieldLabel>
                <div className="flex gap-2">
                  <Textarea
                    id="booking-snippet"
                    readOnly
                    rows={4}
                    className="font-mono text-xs"
                    value={snippet}
                  />
                  <div className="flex flex-col gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
                      <Copy />
                      Copiar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={save.isPending}
                      onClick={() => save.mutate(true)}
                    >
                      <RefreshCw />
                      Trocar chave
                    </Button>
                  </div>
                </div>
                <FieldDescription>
                  No site feito aqui (Meu site), a seção “Agendar” entra sozinha quando o
                  agendamento está ligado — é só publicar de novo.
                </FieldDescription>
              </Field>
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="booking-settings" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function withCurrent(options: readonly { value: number; label: string }[], current: number) {
  return options.some((o) => o.value === current)
    ? options
    : [...options, { value: current, label: String(current) }].sort((a, b) => a.value - b.value)
}
