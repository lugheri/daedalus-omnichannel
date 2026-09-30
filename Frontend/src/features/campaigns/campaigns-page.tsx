import { Mail, MessageSquareText, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCampaigns, type Campaign } from './api'
import { CampaignStatusBadge } from './campaign-status'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function when(campaign: Campaign): string {
  if (campaign.status === 'scheduled' && campaign.scheduledAt) {
    return `Agendada para ${dateTime.format(new Date(campaign.scheduledAt))}`
  }
  if (campaign.startedAt) return `Iniciada em ${dateTime.format(new Date(campaign.startedAt))}`
  return `Criada em ${dateTime.format(new Date(campaign.createdAt))}`
}

export function CampaignsPage() {
  const campaigns = useCampaigns()

  return (
    <>
      <PageHeader
        title="Campanhas"
        description="E-mails e SMS em massa para um público de contatos."
        actions={
          <Button asChild>
            <Link to="/campaigns/new">
              <Plus />
              Nova campanha
            </Link>
          </Button>
        }
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="hidden md:table-cell">Quando</TableHead>
              <TableHead className="text-right">Na fila</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.isPending && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {campaigns.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                  Nenhuma campanha ainda.
                </TableCell>
              </TableRow>
            )}
            {campaigns.data?.items.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell>
                  <Link
                    to={`/campaigns/${campaign.id}`}
                    className="flex items-center gap-2 font-medium hover:underline"
                  >
                    {campaign.channel === 'email' ? (
                      <Mail className="text-muted-foreground size-4" />
                    ) : (
                      <MessageSquareText className="text-muted-foreground size-4" />
                    )}
                    {campaign.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <CampaignStatusBadge status={campaign.status} />
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {when(campaign)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {campaign.status === 'draft' || campaign.status === 'scheduled'
                    ? '—'
                    : campaign.queuedCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
