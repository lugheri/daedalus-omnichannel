import { AlertCircle, Check, Clock, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from './api'
import { kindLabel, messageTime, sendErrorLabel } from './format'

/** Uma mensagem: do cliente à esquerda, nossa à direita (com o status do envio). */
export function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === 'outbound'
  const failed = message.status === 'failed'
  const label = kindLabel(message)

  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-xs',
          outbound ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm',
          failed && 'bg-destructive/10 text-foreground ring-destructive/40 ring-1',
        )}
      >
        {label && <p className="italic opacity-80">{label}</p>}
        {message.text && <p className="break-words whitespace-pre-wrap">{message.text}</p>}

        <div
          className={cn(
            'mt-1 flex items-center justify-end gap-1 text-[11px]',
            outbound && !failed ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          {outbound && !message.senderMembershipId && message.status === 'sent' && (
            <span className="flex items-center gap-0.5" title="Enviada pelo celular">
              <Smartphone className="size-3" /> celular ·
            </span>
          )}
          <span>{messageTime(message.sentAt)}</span>
          {outbound && message.status === 'pending' && (
            <Clock className="size-3" aria-label="Enviando" />
          )}
          {outbound && message.status === 'sent' && (
            <Check className="size-3" aria-label="Enviada" />
          )}
        </div>

        {failed && (
          <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
            <AlertCircle className="size-3.5" />
            {sendErrorLabel(message.error)}
          </p>
        )}
      </div>
    </div>
  )
}
