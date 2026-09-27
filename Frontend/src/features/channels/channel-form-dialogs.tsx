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
import { formatPhoneInput } from '@/lib/phone'
import { channelsApi, channelsQueryKey, type Channel } from './api'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Dê um nome ao canal').max(60),
})
type CreateForm = z.infer<typeof createSchema>

/** Novo canal de WhatsApp. Ao criar, já abre o pareamento (QR code). */
export function CreateChannelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (channel: Channel) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '' },
  })

  const create = useMutation({
    mutationFn: channelsApi.create,
    onSuccess: (channel) => {
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey, exact: true })
      close(false)
      onCreated(channel)
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
          <DialogTitle>Novo canal de WhatsApp</DialogTitle>
          <DialogDescription>
            Conexão não oficial (via WhatsApp Web). Use um número dedicado ao atendimento.
          </DialogDescription>
        </DialogHeader>
        <form id="channel-form" onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
          <FieldGroup>
            <FormError error={create.error} />
            <TextField
              form={form}
              name="name"
              label="Nome"
              placeholder="Ex.: Comercial, Suporte"
              autoFocus
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="channel-form" disabled={create.isPending}>
            {create.isPending ? 'Criando…' : 'Criar e conectar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const testSchema = z.object({
  to: z.string().trim().min(1, 'Informe o número'),
  text: z.string().trim().min(1, 'Escreva a mensagem').max(4096),
})
type TestForm = z.infer<typeof testSchema>

/** Envio avulso para conferir que o canal funciona. */
export function TestMessageDialog({
  channel,
  onOpenChange,
}: {
  channel: Channel | null
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm<TestForm>({
    resolver: zodResolver(testSchema),
    defaultValues: { to: '', text: 'Mensagem de teste do Omnichannel 👋' },
  })

  const send = useMutation({
    mutationFn: (values: TestForm) => channelsApi.sendTestMessage(channel!.id, values),
    onSuccess: () => {
      toast.success('Mensagem enviada para a fila de envio.')
      close(false)
    },
  })

  const close = (next: boolean) => {
    if (!next) {
      form.reset()
      send.reset()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={channel !== null} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mensagem de teste</DialogTitle>
          <DialogDescription>Enviada pelo canal {channel?.name}.</DialogDescription>
        </DialogHeader>
        <form id="test-message-form" onSubmit={form.handleSubmit((v) => send.mutate(v))} noValidate>
          <FieldGroup>
            <FormError error={send.error} />
            <TextField
              form={form}
              name="to"
              label="Para"
              type="tel"
              inputMode="tel"
              placeholder="(11) 98765-4321"
              description="Com DDD, ex.: (11) 98765-4321. Outros países: comece com + e o código do país."
              mask={formatPhoneInput}
              autoFocus
            />
            <TextField form={form} name="text" label="Mensagem" />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="test-message-form" disabled={send.isPending}>
            {send.isPending ? 'Enviando…' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
