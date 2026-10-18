import { MessageCircle, MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Conversation } from './api'

const LABELS = { whatsapp: 'WhatsApp', web_chat: 'Chat do site' } as const

/** Ícone do canal da conversa (WhatsApp ou chat do site), com o nome para leitor de tela. */
export function ChannelKindIcon({
  kind,
  className,
}: {
  kind: Conversation['channel']['kind']
  className?: string
}) {
  if (!kind) return null
  const Icon = kind === 'web_chat' ? MessagesSquare : MessageCircle
  return (
    <span role="img" aria-label={LABELS[kind]} title={LABELS[kind]} className="inline-flex">
      <Icon className={cn('size-3.5 shrink-0', className)} />
    </span>
  )
}
