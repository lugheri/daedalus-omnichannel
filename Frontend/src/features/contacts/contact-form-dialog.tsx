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
import { contactsApi, contactsQueryKey } from './api'

/**
 * Só o formato é checado aqui. Se o telefone é válido (E.164) ou se o
 * contato já existe, quem decide é a API — o erro aparece no topo do form.
 */
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
type ContactForm = z.infer<typeof schema>

export function ContactFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<ContactForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', email: '' },
  })

  const create = useMutation({
    mutationFn: (values: ContactForm) =>
      contactsApi.create({
        name: values.name || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
      }),
    onSuccess: () => {
      toast.success('Contato criado.')
      void queryClient.invalidateQueries({ queryKey: contactsQueryKey })
      close(false)
    },
  })

  const close = (next: boolean) => {
    if (!next) {
      form.reset()
      create.reset()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
          <DialogDescription>
            Telefone no formato internacional: +55 11 98765-4321.
          </DialogDescription>
        </DialogHeader>
        <form id="contact-form" onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
          <FieldGroup>
            <FormError error={create.error} />
            <TextField form={form} name="name" label="Nome" autoFocus />
            <TextField
              form={form}
              name="phone"
              label="Telefone"
              type="tel"
              placeholder="+55 11 98765-4321"
            />
            <TextField form={form} name="email" label="E-mail" type="email" />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="contact-form" disabled={create.isPending}>
            {create.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
