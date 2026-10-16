import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { catalogApi, catalogKeys, type Service } from './api'
import { DURATION_OPTIONS, formatDuration, parsePrice, priceToInput } from './format'

/** Criar (sem `service`) ou editar um serviço. Monte com `key` para recomeçar o formulário. */
export function ServiceDialog({
  service,
  open,
  onOpenChange,
}: {
  service?: Service
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(service?.name ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [duration, setDuration] = useState(service?.durationMinutes ?? 30)
  const [price, setPrice] = useState(priceToInput(service?.priceCents ?? null))
  const [showOnSite, setShowOnSite] = useState(service?.showOnSite ?? true)
  const [submitted, setSubmitted] = useState(false)

  const priceCents = parsePrice(price)
  const nameError = name.trim() ? null : 'Dê um nome ao serviço'
  const priceError = priceCents === undefined ? 'Use só números, como 50 ou 49,90' : null
  // A duração salva pode não estar na lista (veio de outro lugar): entra como opção.
  const durations = DURATION_OPTIONS.includes(duration)
    ? DURATION_OPTIONS
    : [...DURATION_OPTIONS, duration].sort((a, b) => a - b)

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name,
        description: description.trim() || null,
        durationMinutes: duration,
        priceCents: priceCents ?? null,
        showOnSite,
      }
      return service ? catalogApi.updateService(service.id, input) : catalogApi.createService(input)
    },
    onSuccess: () => {
      toast.success(service ? 'Serviço atualizado.' : 'Serviço criado.')
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all })
      onOpenChange(false)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!nameError && !priceError) save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
          <DialogDescription>
            O que o seu negócio oferece. A duração é o tempo que ele ocupa na agenda.
          </DialogDescription>
        </DialogHeader>
        <form id="service-form" onSubmit={submit} noValidate>
          <FieldGroup>
            <FormError error={save.error} />
            <Field data-invalid={submitted && !!nameError}>
              <FieldLabel htmlFor="service-name">Nome</FieldLabel>
              <Input
                id="service-name"
                value={name}
                maxLength={80}
                autoFocus
                placeholder="Ex.: Corte masculino"
                aria-invalid={submitted && !!nameError}
                onChange={(event) => setName(event.target.value)}
              />
              {submitted && nameError && <FieldError>{nameError}</FieldError>}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="service-duration">Duração</FieldLabel>
                <Select
                  value={String(duration)}
                  onValueChange={(value) => setDuration(Number(value))}
                >
                  <SelectTrigger id="service-duration" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durations.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {formatDuration(minutes)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={!!priceError}>
                <FieldLabel htmlFor="service-price">Preço (R$)</FieldLabel>
                <Input
                  id="service-price"
                  inputMode="decimal"
                  value={price}
                  placeholder="Sob consulta"
                  aria-invalid={!!priceError}
                  onChange={(event) => setPrice(event.target.value)}
                />
                {priceError ? (
                  <FieldError>{priceError}</FieldError>
                ) : (
                  <FieldDescription>Vazio = sob consulta.</FieldDescription>
                )}
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="service-description">Descrição (opcional)</FieldLabel>
              <Textarea
                id="service-description"
                rows={3}
                maxLength={1000}
                value={description}
                placeholder="Aparece no site, se o serviço for mostrado lá."
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <div className="flex items-center gap-2">
              <Checkbox
                id="service-on-site"
                checked={showOnSite}
                onCheckedChange={(checked) => setShowOnSite(checked === true)}
              />
              <Label htmlFor="service-on-site">Mostrar no site</Label>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="service-form" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
