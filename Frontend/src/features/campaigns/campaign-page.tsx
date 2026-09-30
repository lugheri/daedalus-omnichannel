import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, CalendarClock, Pencil, Send, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LEAD_SOURCE_LABELS } from '@/features/contacts/lead-source'
import type { OutboundStatus } from '@/features/messaging/api'
import { errorMessage, messageForCode } from '@/lib/api/api-error'
import {
  campaignKeys,
  campaignsApi,
  isInProgress,
  useCampaign,
  useRecipients,
  type CampaignReport,
} from './api'
import { CampaignStatusBadge } from './campaign-status'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const ALL = 'all'

const RECIPIENT_STATUS: Record<OutboundStatus, string> = {
  queued: 'Na fila',
  sent: 'Enviado',
  delivered: 'Entregue',
  failed: 'Falhou',
  bounced: 'Devolvido',
}

/** Resumo, ações e destinatários de uma campanha. */
export function CampaignPage() {
  const { id = '' } = useParams()
  const campaign = useCampaign(id)

  if (campaign.isError) {
    return <p className="text-muted-foreground text-sm">{errorMessage(campaign.error)}</p>
  }
  if (!campaign.data) return <Skeleton className="h-96" />
  return <CampaignView campaign={campaign.data} />
}

function CampaignView({ campaign }: { campaign: CampaignReport }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [scheduling, setScheduling] = useState(false)
  const [confirm, setConfirm] = useState<'send' | 'cancel' | 'delete' | null>(null)
  const [status, setStatus] = useState<OutboundStatus | typeof ALL>(ALL)
  const live = isInProgress(campaign)
  const recipients = useRecipients(campaign.id, status === ALL ? undefined : status, live)
  const editable = campaign.status === 'draft' || campaign.status === 'scheduled'

  const refresh = () => void queryClient.invalidateQueries({ queryKey: campaignKeys.all })
  const act = useMutation({
    mutationFn: (action: 'send' | 'unschedule' | 'cancel' | 'delete'): Promise<unknown> => {
      switch (action) {
        case 'send':
          return campaignsApi.schedule(campaign.id, null)
        case 'unschedule':
          return campaignsApi.unschedule(campaign.id)
        case 'cancel':
          return campaignsApi.cancel(campaign.id)
        case 'delete':
          return campaignsApi.remove(campaign.id)
      }
    },
    onSuccess: (_, action) => {
      toast.success(
        {
          send: 'Envio iniciado.',
          unschedule: 'Agendamento desfeito: voltou para rascunho.',
          cancel: 'Campanha cancelada: o que ainda não saiu não será enviado.',
          delete: 'Campanha excluída.',
        }[action],
      )
      refresh()
      if (action === 'delete') void navigate('/campaigns')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const { counts } = campaign
  const total = campaign.queuedCount
  // Já saíram da fila (o resultado de entrega depende dos avisos do provedor).
  const done = total - counts.queued

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/campaigns">
          <ArrowLeft />
          Campanhas
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {campaign.channel === 'email' ? 'E-mail' : 'SMS'} · {audienceLabel(campaign)}
            {campaign.status === 'scheduled' &&
              campaign.scheduledAt &&
              ` · agendada para ${dateTime.format(new Date(campaign.scheduledAt))}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <Button asChild variant="outline">
                <Link to={`/campaigns/${campaign.id}/edit`}>
                  <Pencil />
                  Editar
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setScheduling(true)}>
                <CalendarClock />
                {campaign.status === 'scheduled' ? 'Reagendar' : 'Agendar'}
              </Button>
              <Button onClick={() => setConfirm('send')}>
                <Send />
                Enviar agora
              </Button>
            </>
          )}
          {campaign.status === 'scheduled' && (
            <Button variant="ghost" onClick={() => act.mutate('unschedule')}>
              <Undo2 />
              Desfazer agendamento
            </Button>
          )}
          {/* Cancelar: enquanto agendada ou com mensagens esperando a vez. */}
          {(live || campaign.status === 'scheduled') && (
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setConfirm('cancel')}
            >
              <Ban />
              Cancelar
            </Button>
          )}
          {campaign.status === 'draft' && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirm('delete')}
            >
              <Trash2 />
              Excluir
            </Button>
          )}
        </div>
      </header>

      {campaign.status !== 'draft' && campaign.status !== 'scheduled' && (
        <section aria-label="Resultado" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Na fila" value={counts.queued} />
          <Stat label="Enviados" value={counts.sent} />
          <Stat label="Entregues" value={counts.delivered} />
          <Stat label="Falharam" value={counts.failed + counts.bounced} tone="bad" />
          <Stat label="Sem endereço" value={campaign.skippedNoAddress} tone="muted" />
          <Stat label="Descadastrados" value={campaign.skippedOptedOut} tone="muted" />
        </section>
      )}
      {total > 0 && (
        <div>
          <div
            role="progressbar"
            aria-label="Progresso do envio"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className="bg-muted h-2 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {done} de {total} já saíram da fila{live && ' — atualizando…'}
          </p>
        </div>
      )}

      <section aria-labelledby="content-title" className="rounded-lg border p-4">
        <h2 id="content-title" className="mb-2 text-sm font-medium">
          Mensagem
        </h2>
        {campaign.subject && <p className="mb-2 font-medium">{campaign.subject}</p>}
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{campaign.body}</p>
      </section>

      {campaign.status !== 'draft' && campaign.status !== 'scheduled' && (
        <section aria-labelledby="recipients-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="recipients-title" className="font-semibold">
              Destinatários
            </h2>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as OutboundStatus | typeof ALL)}
            >
              <SelectTrigger aria-label="Filtrar por situação" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {(Object.keys(RECIPIENT_STATUS) as OutboundStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {RECIPIENT_STATUS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground py-6 text-center">
                      Nenhum destinatário aqui.
                    </TableCell>
                  </TableRow>
                )}
                {recipients.data?.items.map((r) => (
                  <TableRow key={r.messageId}>
                    <TableCell>
                      <Link to={`/contacts/${r.contactId}`} className="hover:underline">
                        {r.contactName ?? 'Sem nome'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.to}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === 'failed' || r.status === 'bounced'
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                        {RECIPIENT_STATUS[r.status]}
                      </Badge>
                      {r.error && (r.status === 'failed' || r.status === 'bounced') && (
                        <span className="text-destructive ml-2 text-xs">
                          {/^[A-Z_]+$/.test(r.error) ? messageForCode(r.error) : r.error}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {recipients.data?.nextCursor && (
            <p className="text-muted-foreground text-xs">Mostrando os primeiros 200.</p>
          )}
        </section>
      )}

      {scheduling && (
        <ScheduleDialog
          campaign={campaign}
          onDone={() => {
            setScheduling(false)
            refresh()
          }}
        />
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'send'
                ? 'Enviar a campanha agora?'
                : confirm === 'cancel'
                  ? 'Cancelar a campanha?'
                  : 'Excluir o rascunho?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'send'
                ? 'O público é montado agora (quem se descadastrou fica de fora) e as mensagens começam a sair. Não dá para desfazer o que já tiver saído.'
                : confirm === 'cancel'
                  ? 'O que ainda não saiu não será enviado. O que já saiu não volta.'
                  : 'A campanha é apagada.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === 'send' ? 'default' : 'destructive'}
              onClick={() => confirm && act.mutate(confirm)}
            >
              {confirm === 'send'
                ? 'Enviar agora'
                : confirm === 'cancel'
                  ? 'Cancelar campanha'
                  : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function audienceLabel({ audience }: CampaignReport): string {
  const parts = [
    audience.source && LEAD_SOURCE_LABELS[audience.source],
    audience.sourceDetail && `“${audience.sourceDetail}”`,
    audience.search && `busca “${audience.search}”`,
  ].filter(Boolean)
  return parts.length ? `Público: ${parts.join(', ')}` : 'Público: todos os contatos'
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'bad' | 'muted' }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          tone === 'bad' && value > 0
            ? 'text-destructive text-2xl font-semibold tabular-nums'
            : tone === 'muted'
              ? 'text-muted-foreground text-2xl font-semibold tabular-nums'
              : 'text-2xl font-semibold tabular-nums'
        }
      >
        {value}
      </p>
    </div>
  )
}

/** Data e hora locais (o navegador converte para o fuso de quem agenda). */
function ScheduleDialog({ campaign, onDone }: { campaign: CampaignReport; onDone: () => void }) {
  const initial = campaign.scheduledAt ? toLocalInput(new Date(campaign.scheduledAt)) : ''
  const [at, setAt] = useState(initial)
  const schedule = useMutation({
    mutationFn: () => campaignsApi.schedule(campaign.id, new Date(at).toISOString()),
    onSuccess: () => {
      toast.success('Campanha agendada.')
      onDone()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar campanha</DialogTitle>
          <DialogDescription>
            O público é montado na hora do envio (contatos novos até lá também entram).
          </DialogDescription>
        </DialogHeader>
        <FormError error={schedule.error} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="schedule-at">Data e hora</Label>
          <Input
            id="schedule-at"
            type="datetime-local"
            value={at}
            min={toLocalInput(new Date())}
            onChange={(event) => setAt(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Cancelar
          </Button>
          <Button disabled={!at || schedule.isPending} onClick={() => schedule.mutate()}>
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Date → valor de <input type="datetime-local"> no fuso do navegador. */
function toLocalInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
