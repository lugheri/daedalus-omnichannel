import { Badge } from '@/components/ui/badge'
import type { ChannelStatus } from './api'

const STATUS: Record<
  ChannelStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Iniciando', variant: 'secondary' },
  awaiting_qr: { label: 'Aguardando QR code', variant: 'outline' },
  connecting: { label: 'Conectando', variant: 'secondary' },
  connected: { label: 'Conectado', variant: 'default' },
  disconnected: { label: 'Desconectado', variant: 'destructive' },
  logged_out: { label: 'Não pareado', variant: 'outline' },
}

export function ChannelStatusBadge({ status }: { status: ChannelStatus }) {
  const { label, variant } = STATUS[status]
  return <Badge variant={variant}>{label}</Badge>
}
