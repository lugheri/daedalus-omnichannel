import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatPhone } from '@/lib/phone'
import { contactMessagingApi, contactMessagingKeys, type MessagingChannel } from './api'
import { smsSegments } from './sms'

/** E-mail ou SMS para um contato (vai para a fila; o status aparece no histórico). */
export function SendMessageDialog({
  contactId,
  channel,
  to,
  open,
  onOpenChange,
}: {
  contactId: string
  channel: MessagingChannel
  /** E-mail ou telefone E.164 do contato. */
  to: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const isEmail = channel === 'email'
  const segments = smsSegments(body)

  const send = useMutation({
    mutationFn: () =>
      contactMessagingApi.send(contactId, {
        channel,
        body,
        ...(isEmail && { subject }),
      }),
    onSuccess: () => {
      toast.success(isEmail ? 'E-mail na fila de envio.' : 'SMS na fila de envio.')
      void queryClient.invalidateQueries({ queryKey: contactMessagingKeys.messages(contactId) })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEmail ? 'Enviar e-mail' : 'Enviar SMS'}</DialogTitle>
          <DialogDescription>
            Para {isEmail ? to : formatPhone(to)}.{' '}
            {isEmail && 'O e-mail sai com um link de descadastro no rodapé.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="send-message-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            send.mutate()
          }}
        >
          <FormError error={send.error} />
          {isEmail && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="message-subject">Assunto</Label>
              <Input
                id="message-subject"
                maxLength={200}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="message-body">Mensagem</Label>
            <Textarea
              id="message-body"
              rows={isEmail ? 8 : 4}
              maxLength={isEmail ? 20_000 : 1_600}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            {!isEmail && (
              <p className="text-muted-foreground text-xs" aria-live="polite">
                {body.length} caracteres · {segments} {segments === 1 ? 'SMS' : 'SMS (cobrados)'}
              </p>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="send-message-form"
            disabled={!body.trim() || (isEmail && !subject.trim()) || send.isPending}
          >
            {send.isPending ? 'Enviando…' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
