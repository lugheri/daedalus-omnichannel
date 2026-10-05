import { useMutation, useQueryClient } from '@tanstack/react-query'
import { History, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useDispositions } from '@/features/dispositions/api'
import { useMemberNames } from '@/features/members/api'
import { useTeams } from '@/features/teams/api'
import { errorMessage, messageForCode } from '@/lib/api/api-error'
import type { Board, BoardColumn } from '../api'
import { automationKeys, automationsApi, useAutomationRuns, type Automation } from './api'
import { describeAction, describeTrigger, RESULT_LABELS, type Names } from './describe'
import { RuleForm } from './rule-form'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Automações de uma coluna: lista, ativar/desativar, criar, editar, execuções. */
export function AutomationsDialog({
  board,
  column,
  rules,
  open,
  onOpenChange,
}: {
  board: Board
  column: BoardColumn
  /** Regras desta coluna. */
  rules: Automation[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const teams = useTeams(open)
  const dispositions = useDispositions()
  const nameOf = useMemberNames()
  const [editing, setEditing] = useState<Automation | 'new' | null>(null)
  const [showRuns, setShowRuns] = useState<string | null>(null)

  const names: Names = {
    column: (id) => board.columns.find((c) => c.id === id)?.name,
    team: (id) => teams.data?.find((t) => t.id === id)?.name,
    member: (id) => nameOf(id),
    disposition: (id) => dispositions.data?.find((d) => d.id === id)?.name,
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: automationKeys.list(board.id) })

  const toggle = useMutation({
    mutationFn: (rule: Automation) =>
      automationsApi.update(board.id, rule.id, { enabled: !rule.enabled }),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (rule: Automation) => automationsApi.remove(board.id, rule.id),
    onSuccess: () => {
      toast.success('Automação excluída.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Automações de “{column.name}”</DialogTitle>
          <DialogDescription>
            O que acontece sozinho com os cards desta coluna. Mensagens saem uma vez só por disparo.
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <RuleForm
            key={editing === 'new' ? 'new' : editing.id}
            board={board}
            columnId={column.id}
            rule={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {rules.length === 0 && (
              <p className="text-muted-foreground text-sm">Nenhuma automação nesta coluna.</p>
            )}
            <ul className="flex flex-col gap-2">
              {rules.map((rule) => (
                <li key={rule.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      className="mt-0.5"
                      checked={rule.enabled}
                      aria-label={rule.enabled ? 'Desativar automação' : 'Ativar automação'}
                      onCheckedChange={() => toggle.mutate(rule)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{describeTrigger(rule.trigger, names)}</p>
                      <ul className="text-muted-foreground mt-1 list-disc pl-5">
                        {rule.actions.map((action, i) => (
                          <li key={i}>{describeAction(action, names)}</li>
                        ))}
                      </ul>
                      {!rule.enabled && <Badge variant="outline">Desativada</Badge>}
                    </div>
                    <div className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Execuções"
                        title="Execuções"
                        onClick={() => setShowRuns(showRuns === rule.id ? null : rule.id)}
                      >
                        <History />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Editar automação"
                        onClick={() => setEditing(rule)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Excluir automação"
                        onClick={() => remove.mutate(rule)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  {showRuns === rule.id && <RunList board={board} rule={rule} />}
                </li>
              ))}
            </ul>
            {rules.length < 10 && (
              <Button variant="outline" className="self-start" onClick={() => setEditing('new')}>
                <Plus />
                Nova automação
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

const STATUS = {
  running: { label: 'em andamento', variant: 'outline' },
  succeeded: { label: 'ok', variant: 'success' },
  failed: { label: 'com falha', variant: 'destructive' },
} as const

function RunList({ board, rule }: { board: Board; rule: Automation }) {
  const runs = useAutomationRuns(board.id, rule.id, true)
  if (runs.isPending) return <Skeleton className="mt-2 h-10" />
  if (!runs.data?.length) {
    return <p className="text-muted-foreground mt-2 text-xs">Ainda não disparou.</p>
  }
  return (
    <ul className="mt-2 flex flex-col gap-1 border-t pt-2 text-xs" aria-label="Execuções">
      {runs.data.map((run) => (
        <li key={run.id} className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{dateTime.format(new Date(run.createdAt))}</span>
          <Badge variant={STATUS[run.status].variant}>{STATUS[run.status].label}</Badge>
          <Link to={`/conversations/${run.conversationId}`} className="hover:underline">
            conversa
          </Link>
          {run.results
            .filter((r) => r.error)
            .map((r, i) => (
              <span key={i} className={r.ok ? 'text-muted-foreground' : 'text-destructive'}>
                {RESULT_LABELS[r.error!] ?? messageForCode(r.error!)}
              </span>
            ))}
        </li>
      ))}
    </ul>
  )
}
