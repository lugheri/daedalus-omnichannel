import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
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
import { formatPhone, formatPhoneInput } from '@/lib/phone'
import { contactsApi, contactsQueryKey, type Contact } from './api'

const schema = z
  .object({
    name: z.string().trim().max(200),
    phone: z.string().trim().max(32),
    email: z.union([z.literal(''), z.email('E-mail inválido')]),
  })
  .refine((v) => v.phone || v.email, {
    message: 'Informe ao menos um telefone ou e-mail',
    path: ['phone'],
  })
type EditForm = z.infer<typeof schema>

/** Edição de nome, telefone e e-mail. A origem não muda (é histórico). */
export function ContactEditDialog({
  contact,
  open,
  onOpenChange,
}: {
  contact: Contact
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<EditForm>({
    resolver: zodResolver(schema),
    values: {
      name: contact.name ?? '',
      phone: contact.phone ? formatPhone(contact.phone) : '',
      email: contact.email ?? '',
    },
  })

  const save = useMutation({
    mutationFn: (values: EditForm) =>
      contactsApi.update(contact.id, {
        name: values.name || null,
        phone: values.phone || null,
        email: values.email || null,
      }),
    onSuccess: () => {
      toast.success('Contato atualizado.')
      void queryClient.invalidateQueries({ queryKey: contactsQueryKey })
      close(false)
    },
  })

  const close = (next: boolean) => {
    if (!next) save.reset()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
          <DialogDescription>Telefone com DDD, ex.: (11) 98765-4321.</DialogDescription>
        </DialogHeader>
        <form id="contact-edit-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <FieldGroup>
            <FormError error={save.error} />
            <TextField form={form} name="name" label="Nome" autoFocus />
            <TextField
              form={form}
              name="phone"
              label="Telefone"
              type="tel"
              inputMode="tel"
              mask={formatPhoneInput}
            />
            <TextField form={form} name="email" label="E-mail" type="email" />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="contact-edit-form" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
