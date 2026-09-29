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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useMe } from '@/features/auth/session-context'
import { useDispositionLookup, useDispositions } from '@/features/dispositions/api'
import { DispositionBadge } from '@/features/dispositions/disposition-badge'
import { DISPOSITION_STYLES } from '@/features/dispositions/colors'
import { useMemberNames } from '@/features/members/api'
import { cn } from '@/lib/utils'
import { conversationKeys, conversationsApi, useConversationDispositions } from './api'

const NOTE_MAX = 1000
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Tabular o atendimento. No modo `resolve`, tabula e resolve de uma vez
 * (é o que o "Resolver" abre quando a conta exige tabulação).
 */
export function TabulateDialog({
  conversationId,
  mode,
  open,
  onOpenChange,
}: {
  conversationId: string
  mode: 'tabulate' | 'resolve'
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const dispositions = useDispositions()
  const history = useConversationDispositions(conversationId, open)
  const lookup = useDispositionLookup()
  const nameOf = useMemberNames()
  const me = useMe()
  const [dispositionId, setDispositionId] = useState('')
  const [note, setNote] = useState('')
  const options = dispositions.data?.filter((d) => !d.archived) ?? []

  const save = useMutation({
    mutationFn: () => {
      const input = { dispositionId, note: note.trim() || undefined }
      return mode === 'resolve'
        ? conversationsApi.changeStatus(conversationId, 'resolved', input)
        : conversationsApi.tabulate(conversationId, input).then(() => undefined)
    },
    onSuccess: () => {
      toast.success(mode === 'resolve' ? 'Conversa resolvida.' : 'Atendimento tabulado.')
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all })
      close(false)
    },
  })

  function close(next: boolean) {
    if (!next) {
      setDispositionId('')
      setNote('')
      save.reset()
    }
    onOpenChange(next)
  }

  const records = history.data ?? []

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'resolve' ? 'Resolver atendimento' : 'Tabular atendimento'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'resolve'
              ? 'Para resolver, escolha como o atendimento terminou.'
              : 'Classifique o atendimento. Pode tabular de novo depois: fica tudo no histórico.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FormError error={save.error} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="tabulate-disposition">Tabulação</Label>
            <Select value={dispositionId} onValueChange={setDispositionId}>
              <SelectTrigger id="tabulate-disposition" className="w-full">
                <SelectValue placeholder="Escolha…" />
              </SelectTrigger>
              <SelectContent>
                {options.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span
                      className={cn('size-2.5 rounded-full', DISPOSITION_STYLES[d.color].swatch)}
                    />
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dispositions.isSuccess && options.length === 0 && (
              <p className="text-muted-foreground text-sm">
                A conta ainda não tem tabulações (Configurações → Tabulações).
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tabulate-note">Observação (opcional)</Label>
            <Textarea
              id="tabulate-note"
              rows={3}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: fechou o plano anual, retorna em março…"
            />
          </div>

          {(history.isPending || records.length > 0) && (
            <section aria-labelledby="tabulate-history" className="flex flex-col gap-2">
              <h3 id="tabulate-history" className="text-sm font-medium">
                Histórico
              </h3>
              {history.isPending && <Skeleton className="h-10" />}
              <ul className="flex max-h-44 flex-col gap-2 overflow-y-auto text-sm">
                {records.map((record) => {
                  const disposition = lookup(record.dispositionId)
                  return (
                    <li key={record.id} className="rounded-md border p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {disposition && <DispositionBadge disposition={disposition} />}
                        <span className="text-muted-foreground text-xs">
                          {dateTime.format(new Date(record.createdAt))} ·{' '}
                          {record.membershipId === me.membershipId
                            ? 'você'
                            : (nameOf(record.membershipId) ?? 'ex-membro')}
                        </span>
                      </div>
                      {record.note && <p className="mt-1 whitespace-pre-wrap">{record.note}</p>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button disabled={!dispositionId || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Salvando…' : mode === 'resolve' ? 'Tabular e resolver' : 'Tabular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
