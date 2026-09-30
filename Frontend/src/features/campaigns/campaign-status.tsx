import { Badge } from '@/components/ui/badge'
import type { CampaignStatus } from './api'

const STATUS: Record<
  CampaignStatus,
  { label: string; variant: 'outline' | 'secondary' | 'destructive' | 'default' }
> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  scheduled: { label: 'Agendada', variant: 'secondary' },
  sending: { label: 'Enviando', variant: 'default' },
  sent: { label: 'Enviada', variant: 'secondary' },
  canceled: { label: 'Cancelada', variant: 'destructive' },
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>
}
