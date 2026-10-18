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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  FEATURE_LABELS,
  LIMIT_LABELS,
  PLAN_FEATURES,
  PLAN_LIMITS,
  planKeys,
  plansApi,
  type Plan,
  type PlanFeatures,
  type PlanLimit,
  type PlanLimits,
} from './api'

const empty = (): { limits: PlanLimits; features: PlanFeatures } => ({
  limits: Object.fromEntries(PLAN_LIMITS.map((l) => [l, null])) as PlanLimits,
  features: Object.fromEntries(PLAN_FEATURES.map((f) => [f, true])) as PlanFeatures,
})

/** Criar ou editar um plano: limites (vazio = sem limite), recursos e se é de revenda. */
export function PlanDialog({
  plan,
  onOpenChange,
}: {
  plan?: Plan
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(plan?.name ?? '')
  const [description, setDescription] = useState(plan?.description ?? '')
  const [limits, setLimits] = useState<Record<PlanLimit, string>>(
    () =>
      Object.fromEntries(
        PLAN_LIMITS.map((l) => [l, String((plan?.limits ?? empty().limits)[l] ?? '')]),
      ) as Record<PlanLimit, string>,
  )
  const [features, setFeatures] = useState<PlanFeatures>(plan?.features ?? empty().features)
  const [resellable, setResellable] = useState(plan?.resellable ?? false)
  const invalid = PLAN_LIMITS.filter((l) => limits[l].trim() && !/^\d+$/.test(limits[l].trim()))

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name,
        description: description.trim() || null,
        limits: Object.fromEntries(
          PLAN_LIMITS.map((l) => [l, limits[l].trim() ? Number(limits[l]) : null]),
        ) as PlanLimits,
        features,
        resellable,
      }
      return plan ? plansApi.update(plan.id, input) : plansApi.create(input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all })
      toast.success(plan ? 'Plano salvo. Vale na hora para as contas dele.' : 'Plano criado.')
      onOpenChange(false)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim() && invalid.length === 0) save.mutate()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan ? `Plano ${plan.name}` : 'Novo plano'}</DialogTitle>
          <DialogDescription>
            Limite novo barra o que for criado daqui em diante; o que a conta já tem continua
            funcionando.
          </DialogDescription>
        </DialogHeader>
        <form id="plan-form" onSubmit={submit} noValidate>
          <FieldGroup>
            <FormError error={save.error} />
            <Field>
              <FieldLabel htmlFor="plan-name">Nome</FieldLabel>
              <Input
                id="plan-name"
                autoFocus
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-description">Descrição</FieldLabel>
              <Textarea
                id="plan-description"
                rows={2}
                maxLength={300}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <fieldset className="grid gap-3">
              <legend className="mb-1 text-sm font-medium">Limites (vazio = sem limite)</legend>
              {PLAN_LIMITS.map((limit) => (
                <div key={limit} className="grid grid-cols-[1fr_7rem] items-center gap-3">
                  <Label htmlFor={`limit-${limit}`} className="grid gap-0.5 font-normal">
                    {LIMIT_LABELS[limit].label}
                    {LIMIT_LABELS[limit].hint && (
                      <span className="text-muted-foreground text-xs">
                        {LIMIT_LABELS[limit].hint}
                      </span>
                    )}
                  </Label>
                  <Input
                    id={`limit-${limit}`}
                    inputMode="numeric"
                    placeholder="Sem limite"
                    aria-invalid={invalid.includes(limit)}
                    value={limits[limit]}
                    onChange={(event) =>
                      setLimits((current) => ({ ...current, [limit]: event.target.value }))
                    }
                  />
                </div>
              ))}
              {invalid.length > 0 && (
                <p className="text-destructive text-sm">
                  Use só números inteiros (ou deixe vazio).
                </p>
              )}
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Recursos</legend>
              {PLAN_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <Checkbox
                    id={`feature-${feature}`}
                    checked={features[feature]}
                    onCheckedChange={(checked) =>
                      setFeatures((current) => ({ ...current, [feature]: checked === true }))
                    }
                  />
                  <Label htmlFor={`feature-${feature}`} className="font-normal">
                    {FEATURE_LABELS[feature]}
                  </Label>
                </div>
              ))}
            </fieldset>
            <div className="flex items-start gap-2">
              <Checkbox
                id="plan-resellable"
                checked={resellable}
                onCheckedChange={(checked) => setResellable(checked === true)}
              />
              <div className="grid gap-0.5">
                <Label htmlFor="plan-resellable">Liberado para revenda</Label>
                <p className="text-muted-foreground text-xs">
                  Revendedores podem dar este plano às contas deles.
                </p>
              </div>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="plan-form"
            disabled={!name.trim() || invalid.length > 0 || save.isPending}
          >
            {save.isPending ? 'Salvando…' : plan ? 'Salvar' : 'Criar plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
