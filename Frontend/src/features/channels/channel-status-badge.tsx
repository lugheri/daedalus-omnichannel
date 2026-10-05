import { Badge } from '@/components/ui/badge'
import type { ChannelStatus } from './api'

const STATUS: Record<
  ChannelStatus,
  {
    label: string
    variant: 'outline' | 'secondary' | 'destructive' | 'default' | 'success' | 'warning'
  }
> = {
  pending: { label: 'Iniciando', variant: 'secondary' },
  awaiting_qr: { label: 'Aguardando QR code', variant: 'warning' },
  connecting: { label: 'Conectando', variant: 'secondary' },
  connected: { label: 'Conectado', variant: 'success' },
  disconnected: { label: 'Desconectado', variant: 'destructive' },
  logged_out: { label: 'Não pareado', variant: 'outline' },
}

export function ChannelStatusBadge({ status }: { status: ChannelStatus }) {
  const { label, variant } = STATUS[status]
  return <Badge variant={variant}>{label}</Badge>
}
