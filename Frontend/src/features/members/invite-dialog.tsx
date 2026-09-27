import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRoles } from '@/features/roles/api'
import { invitationsQueryKey, membersApi } from './api'

const schema = z.object({
  email: z.email('Informe um e-mail válido'),
  roleId: z.string().min(1, 'Escolha um cargo'),
})
type InviteForm = z.infer<typeof schema>

/**
 * Convida por e-mail. Enquanto a plataforma não envia e-mails, o link gerado
 * aparece aqui para quem convidou copiar e repassar.
 */
export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const roles = useRoles()
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const form = useForm<InviteForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', roleId: '' },
  })

  const invite = useMutation({
    mutationFn: membersApi.invite,
    onSuccess: (invitation) => {
      setInviteUrl(invitation.inviteUrl)
      void queryClient.invalidateQueries({ queryKey: invitationsQueryKey })
    },
  })

  const close = (next: boolean) => {
    if (!next) {
      form.reset()
      invite.reset()
      setInviteUrl(null)
      setCopied(false)
    }
    onOpenChange(next)
  }

  const copy = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{inviteUrl ? 'Convite criado' : 'Convidar membro'}</DialogTitle>
          <DialogDescription>
            {inviteUrl
              ? 'Envie este link para a pessoa convidada. Ele vale por 7 dias e só pode ser usado uma vez.'
              : 'A pessoa entra na conta com o cargo escolhido.'}
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="flex gap-2">
            <Input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void copy()}
              aria-label="Copiar link"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        ) : (
          <form id="invite-form" onSubmit={form.handleSubmit((v) => invite.mutate(v))} noValidate>
            <FieldGroup>
              <FormError error={invite.error} />
              <TextField form={form} name="email" label="E-mail" type="email" autoFocus />
              <Controller
                control={form.control}
                name="roleId"
                render={({ field, fieldState }) => (
                  <Field data-invalid={!!fieldState.error}>
                    <FieldLabel htmlFor="roleId">Cargo</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="roleId" aria-invalid={!!fieldState.error}>
                        <SelectValue placeholder="Escolha um cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.data?.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
        )}

        <DialogFooter>
          {inviteUrl ? (
            <Button onClick={() => close(false)}>Concluir</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="invite-form" disabled={invite.isPending}>
                {invite.isPending ? 'Convidando…' : 'Convidar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
