import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/auth/session-context'
import { useMemberNames } from '@/features/members/api'
import { errorMessage, messageForCode } from '@/lib/api/api-error'
import {
  contactMessagingApi,
  contactMessagingKeys,
  useAvailableChannels,
  useContactMessages,
  useContactOptOuts,
  type MessagingChannel,
  type OptOut,
  type OutboundStatus,
} from './api'
import { SendMessageDialog } from './send-message-dialog'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const STATUS: Record<
  OutboundStatus,
  {
    label: string
    variant: 'outline' | 'secondary' | 'destructive' | 'default' | 'success' | 'warning'
  }
> = {
  queued: { label: 'Na fila', variant: 'outline' },
  sent: { label: 'Enviado', variant: 'secondary' },
  delivered: { label: 'Entregue', variant: 'success' },
  failed: { label: 'Falhou', variant: 'destructive' },
  bounced: { label: 'Devolvido', variant: 'destructive' },
}

const OPT_OUT_SOURCE: Record<OptOut['source'], string> = {
  unsubscribe_link: 'pelo link no e-mail',
  sms_reply: 'respondendo SAIR',
  provider: 'pelo provedor (descadastro ou denúncia de spam)',
  manual: 'manualmente',
}

const CHANNEL_LABEL: Record<MessagingChannel, string> = { email: 'e-mails', sms: 'SMS' }

/** "Enviar e-mail" / "Enviar SMS" no cabeçalho da ficha. */
export function ContactSendButtons({
  contactId,
  email,
  phone,
}: {
  contactId: string
  email: string | null
  phone: string | null
}) {
  const { can } = usePermissions()
  const allowed = can('messaging:send')
  const channels = useAvailableChannels(allowed)
  const optOuts = useContactOptOuts(contactId)
  const [sending, setSending] = useState<MessagingChannel | null>(null)
  if (!allowed) return null

  const optedOut = (channel: MessagingChannel) =>
    optOuts.data?.some((o) => o.channel === channel) ?? false
  const why = (channel: MessagingChannel, address: string | null) =>
    !channels.data?.[channel]
      ? 'O envio por este canal não foi configurado (Configurações → E-mail e SMS).'
      : !address
        ? channel === 'email'
          ? 'O contato não tem e-mail.'
          : 'O contato não tem telefone.'
        : optedOut(channel)
          ? 'O contato pediu para não receber.'
          : undefined

  const button = (channel: MessagingChannel, address: string | null) => {
    const reason = why(channel, address)
    return (
      <Button
        variant="outline"
        disabled={Boolean(reason) || !channels.data}
        title={reason}
        onClick={() => setSending(channel)}
      >
        {channel === 'email' ? <Mail /> : <MessageSquareText />}
        {channel === 'email' ? 'Enviar e-mail' : 'Enviar SMS'}
      </Button>
    )
  }

  return (
    <>
      {button('email', email)}
      {button('sms', phone)}
      {sending && (
        <SendMessageDialog
          contactId={contactId}
          channel={sending}
          to={(sending === 'email' ? email : phone) ?? ''}
          open
          onOpenChange={() => setSending(null)}
        />
      )}
    </>
  )
}

/** E-mails e SMS enviados ao contato, com o status de entrega, e os descadastros. */
export function ContactMessages({ contactId }: { contactId: string }) {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const messages = useContactMessages(contactId)
  const optOuts = useContactOptOuts(contactId)
  const nameOf = useMemberNames()
  const [reactivating, setReactivating] = useState<OptOut | null>(null)

  const reactivate = useMutation({
    mutationFn: (optOut: OptOut) => contactMessagingApi.reactivate(contactId, optOut.channel),
    onSuccess: () => {
      toast.success('Recebimento reativado.')
      void queryClient.invalidateQueries({ queryKey: contactMessagingKeys.optOuts(contactId) })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <section aria-labelledby="messages-title" className="flex flex-col gap-3">
      <h2 id="messages-title" className="font-semibold">
        E-mails e SMS
      </h2>

      {optOuts.data?.map((optOut) => (
        <div
          key={optOut.channel}
          role="note"
          className="bg-muted flex flex-wrap items-center justify-between gap-2 rounded-md p-3 text-sm"
        >
          <span>
            Não recebe {CHANNEL_LABEL[optOut.channel]}: descadastrou-se{' '}
            {OPT_OUT_SOURCE[optOut.source]} em {dateTime.format(new Date(optOut.createdAt))}.
          </span>
          {can('messaging:manage') && (
            <Button variant="ghost" size="sm" onClick={() => setReactivating(optOut)}>
              Reativar
            </Button>
          )}
        </div>
      ))}

      {messages.isPending && <Skeleton className="h-16" />}
      {messages.data?.length === 0 && (
        <p className="text-muted-foreground text-sm">Nenhum e-mail ou SMS enviado.</p>
      )}
      <ul className="flex flex-col gap-2">
        {messages.data?.map((message) => (
          <li key={message.id} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                {message.channel === 'email' ? (
                  <Mail className="text-muted-foreground size-4 shrink-0" />
                ) : (
                  <MessageSquareText className="text-muted-foreground size-4 shrink-0" />
                )}
                <span className="truncate">{message.subject ?? message.body.slice(0, 80)}</span>
              </span>
              <Badge variant={STATUS[message.status].variant}>{STATUS[message.status].label}</Badge>
            </div>
            {message.subject && (
              <p className="text-muted-foreground mt-1 line-clamp-2">{message.body}</p>
            )}
            {message.error && (message.status === 'failed' || message.status === 'bounced') && (
              <p className="text-destructive mt-1 text-xs">
                {/^[A-Z_]+$/.test(message.error) ? messageForCode(message.error) : message.error}
              </p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {dateTime.format(new Date(message.createdAt))} ·{' '}
              {message.campaignId
                ? 'Campanha'
                : (nameOf(message.sentByMembershipId) ?? 'ex-membro')}{' '}
              · {message.to}
            </p>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={reactivating !== null}
        onOpenChange={(open) => !open && setReactivating(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar o recebimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Faça isso só se o próprio contato pediu para voltar a receber (ex.: numa conversa).
              Enviar para quem se descadastrou prejudica a reputação de envio e pode contrariar a
              LGPD.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => reactivating && reactivate.mutate(reactivating)}>
              Reativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
