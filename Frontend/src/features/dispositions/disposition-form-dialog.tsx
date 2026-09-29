import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormError } from '@/components/form/form-error'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { DISPOSITION_COLORS, dispositionsApi, dispositionsQueryKey, type Disposition } from './api'
import { DISPOSITION_STYLES } from './colors'
import { DispositionBadge } from './disposition-badge'

const schema = z.object({
  name: z.string().trim().min(1, 'Dê um nome à tabulação').max(60, 'Máximo de 60 caracteres'),
  color: z.enum(DISPOSITION_COLORS),
})
type DispositionForm = z.infer<typeof schema>

/** Criar (sem `disposition`) ou editar uma tabulação. */
export function DispositionFormDialog({
  disposition,
  open,
  onOpenChange,
}: {
  disposition?: Disposition
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<DispositionForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', color: 'blue' },
  })

  useEffect(() => {
    if (open) {
      form.reset(
        disposition
          ? { name: disposition.name, color: disposition.color }
          : { name: '', color: 'blue' },
      )
    }
  }, [open, disposition, form])

  const save = useMutation({
    mutationFn: (values: DispositionForm) =>
      disposition ? dispositionsApi.update(disposition.id, values) : dispositionsApi.create(values),
    onSuccess: () => {
      toast.success(disposition ? 'Tabulação atualizada.' : 'Tabulação criada.')
      void queryClient.invalidateQueries({ queryKey: dispositionsQueryKey })
      onOpenChange(false)
    },
  })

  const close = (next: boolean) => {
    if (!next) save.reset()
    onOpenChange(next)
  }

  const preview = useWatch({ control: form.control })

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{disposition ? 'Editar tabulação' : 'Nova tabulação'}</DialogTitle>
          <DialogDescription>
            Ex.: “Venda realizada”, “Sem interesse”, “Proposta enviada”.
          </DialogDescription>
        </DialogHeader>
        <form id="disposition-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <FieldGroup>
            <FormError error={save.error} />
            <TextField form={form} name="name" label="Nome" autoFocus />
            <div className="flex flex-col gap-2">
              <Label id="disposition-color">Cor</Label>
              <Controller
                control={form.control}
                name="color"
                render={({ field }) => (
                  <div
                    role="radiogroup"
                    aria-labelledby="disposition-color"
                    className="flex flex-wrap gap-2"
                  >
                    {DISPOSITION_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={field.value === color}
                        aria-label={DISPOSITION_STYLES[color].label}
                        title={DISPOSITION_STYLES[color].label}
                        onClick={() => field.onChange(color)}
                        className={cn(
                          'flex size-8 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          DISPOSITION_STYLES[color].swatch,
                          field.value === color && 'ring-2 ring-foreground',
                        )}
                      >
                        {field.value === color && <Check className="size-4" />}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              Prévia:
              <DispositionBadge
                disposition={{
                  name: preview.name?.trim() || 'Nome',
                  color: preview.color ?? 'blue',
                }}
              />
            </div>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="disposition-form" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
