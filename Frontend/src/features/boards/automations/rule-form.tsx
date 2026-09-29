import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, MoveRight, Plus, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/form/form-error'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useDispositions } from '@/features/dispositions/api'
import { useMemberDirectory } from '@/features/members/api'
import { useTeams } from '@/features/teams/api'
import type { Board } from '../api'
import {
  automationKeys,
  automationsApi,
  MOVE_INTO_TRIGGERS,
  type Automation,
  type AutomationAction,
  type AutomationTrigger,
  type TriggerType,
} from './api'

/** Marcadores do Select (o Radix não aceita valor vazio). */
const KEEP = 'keep'
const NONE = 'none'

type Unit = 'minutes' | 'hours' | 'days'
const UNIT_MINUTES: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440 }

/** Ação em edição (a atribuição usa os marcadores KEEP/NONE nos selects). */
type Draft =
  | { key: number; type: 'send_message'; text: string }
  | { key: number; type: 'assign'; team: string; member: string }
  | { key: number; type: 'move'; columnId: string }

const TRIGGER_LABELS: Record<TriggerType, string> = {
  card_entered: 'Quando o card entrar nesta coluna',
  card_idle: 'Quando o card ficar parado nesta coluna por…',
  disposition_set: 'Mover para cá quando a conversa for tabulada como…',
  conversation_resolved: 'Mover para cá quando a conversa for resolvida',
  customer_replied: 'Mover para cá quando o cliente responder',
}

let nextKey = 1

function toDraft(action: AutomationAction): Draft {
  const key = nextKey++
  if (action.type === 'send_message') return { key, type: 'send_message', text: action.text }
  if (action.type === 'move') return { key, type: 'move', columnId: action.columnId }
  const choice = (value: string | null | undefined) =>
    value === undefined ? KEEP : value === null ? NONE : value
  return { key, type: 'assign', team: choice(action.teamId), member: choice(action.assigneeId) }
}

function fromDraft(draft: Draft): AutomationAction {
  if (draft.type === 'send_message') return { type: 'send_message', text: draft.text }
  if (draft.type === 'move') return { type: 'move', columnId: draft.columnId }
  const value = (choice: string) => (choice === NONE ? null : choice)
  return {
    type: 'assign',
    ...(draft.team !== KEEP && { teamId: value(draft.team) }),
    ...(draft.member !== KEEP && { assigneeId: value(draft.member) }),
  }
}

function splitMinutes(minutes: number): { value: number; unit: Unit } {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: 'days' }
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' }
  return { value: minutes, unit: 'minutes' }
}

/** Criar (sem `rule`) ou editar uma regra da coluna. */
export function RuleForm({
  board,
  columnId,
  rule,
  onDone,
}: {
  board: Board
  columnId: string
  rule?: Automation
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const dispositions = useDispositions()
  const teams = useTeams()
  const members = useMemberDirectory()

  const initialIdle = rule?.trigger.type === 'card_idle' ? splitMinutes(rule.trigger.minutes) : null
  const [triggerType, setTriggerType] = useState<TriggerType>(rule?.trigger.type ?? 'card_entered')
  const [idleValue, setIdleValue] = useState(String(initialIdle?.value ?? 1))
  const [idleUnit, setIdleUnit] = useState<Unit>(initialIdle?.unit ?? 'days')
  const [dispositionId, setDispositionId] = useState(
    rule?.trigger.type === 'disposition_set' ? rule.trigger.dispositionId : '',
  )
  const [drafts, setDrafts] = useState<Draft[]>(rule?.actions.map(toDraft) ?? [])
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)

  const movesInto = MOVE_INTO_TRIGGERS.includes(triggerType)
  const otherColumns = board.columns.filter((c) => c.id !== columnId)
  const activeDispositions = dispositions.data?.filter((d) => !d.archived) ?? []

  const trigger = (): AutomationTrigger => {
    if (triggerType === 'card_idle') {
      return { type: 'card_idle', minutes: Math.round(Number(idleValue) * UNIT_MINUTES[idleUnit]) }
    }
    if (triggerType === 'disposition_set') return { type: 'disposition_set', dispositionId }
    return { type: triggerType }
  }

  const save = useMutation({
    mutationFn: () => {
      const input = {
        trigger: trigger(),
        actions: movesInto ? [] : drafts.map(fromDraft),
        enabled,
      }
      return rule
        ? automationsApi.update(board.id, rule.id, input)
        : automationsApi.create(board.id, { ...input, columnId })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationKeys.list(board.id) })
      onDone()
    },
  })

  const update = (key: number, change: Partial<Draft>) =>
    setDrafts((current) => current.map((d) => (d.key === key ? ({ ...d, ...change } as Draft) : d)))
  const add = (type: Draft['type']) =>
    setDrafts((current) => [
      ...current,
      type === 'send_message'
        ? { key: nextKey++, type, text: '' }
        : type === 'assign'
          ? { key: nextKey++, type, team: KEEP, member: KEEP }
          : { key: nextKey++, type, columnId: otherColumns[0]?.id ?? '' },
    ])

  const invalid =
    (triggerType === 'card_idle' && !(Number(idleValue) > 0)) ||
    (triggerType === 'disposition_set' && !dispositionId) ||
    (!movesInto && drafts.length === 0)

  return (
    <form
      className="flex flex-col gap-4"
      aria-label={rule ? 'Editar automação' : 'Nova automação'}
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <FormError error={save.error} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="rule-trigger">Gatilho</Label>
        <Select
          value={triggerType}
          onValueChange={(v) => {
            const next = v as TriggerType
            setTriggerType(next)
            // "Mover" só existe no gatilho de tempo parado.
            if (next !== 'card_idle')
              setDrafts((current) => current.filter((d) => d.type !== 'move'))
          }}
        >
          <SelectTrigger id="rule-trigger" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {TRIGGER_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {triggerType === 'card_idle' && (
        <div className="flex gap-2">
          <Input
            aria-label="Tempo parado"
            type="number"
            min={1}
            className="w-24"
            value={idleValue}
            onChange={(event) => setIdleValue(event.target.value)}
          />
          <Select value={idleUnit} onValueChange={(v) => setIdleUnit(v as Unit)}>
            <SelectTrigger aria-label="Unidade" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">minutos</SelectItem>
              <SelectItem value="hours">horas</SelectItem>
              <SelectItem value="days">dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {triggerType === 'card_idle' && (
        <p className="text-muted-foreground -mt-2 text-xs">
          Conta a partir de quando a regra é ativada: cards que já estavam parados não disparam na
          hora.
        </p>
      )}

      {triggerType === 'disposition_set' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="rule-disposition">Tabulação</Label>
          <Select value={dispositionId} onValueChange={setDispositionId}>
            <SelectTrigger id="rule-disposition" className="w-full">
              <SelectValue placeholder="Escolha…" />
            </SelectTrigger>
            <SelectContent>
              {activeDispositions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {movesInto ? (
        <p className="text-muted-foreground text-sm">
          O card vai para esta coluna em todo quadro em que a conversa estiver.
        </p>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">Ações</legend>
          {drafts.length === 0 && (
            <p className="text-muted-foreground text-sm">Adicione ao menos uma ação.</p>
          )}
          {drafts.map((draft, index) => (
            <div key={draft.key} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {index + 1}.{' '}
                  {draft.type === 'send_message'
                    ? 'Enviar mensagem'
                    : draft.type === 'assign'
                      ? 'Atribuir'
                      : 'Mover para a coluna'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Remover ação ${index + 1}`}
                  onClick={() => setDrafts((current) => current.filter((d) => d.key !== draft.key))}
                >
                  <Trash2 />
                </Button>
              </div>
              {draft.type === 'send_message' && (
                <>
                  <Textarea
                    aria-label={`Mensagem da ação ${index + 1}`}
                    rows={3}
                    maxLength={2000}
                    value={draft.text}
                    placeholder="Olá {{nome}}, tudo bem? …"
                    onChange={(event) => update(draft.key, { text: event.target.value })}
                  />
                  <p className="text-muted-foreground text-xs">
                    {'{{nome}}'} vira o primeiro nome do cliente; {'{{nome_completo}}'}, o nome
                    inteiro. Sai pelo WhatsApp da conversa, marcada como “Automação”.
                  </p>
                </>
              )}
              {draft.type === 'assign' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select value={draft.team} onValueChange={(team) => update(draft.key, { team })}>
                    <SelectTrigger aria-label={`Equipe da ação ${index + 1}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={KEEP}>Equipe: não mudar</SelectItem>
                      <SelectItem value={NONE}>Fila geral (sem equipe)</SelectItem>
                      {teams.data?.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={draft.member}
                    onValueChange={(member) => update(draft.key, { member })}
                  >
                    <SelectTrigger aria-label={`Pessoa da ação ${index + 1}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={KEEP}>Pessoa: não mudar</SelectItem>
                      <SelectItem value={NONE}>Sem responsável (fila)</SelectItem>
                      {members.data?.map((m) => (
                        <SelectItem key={m.membershipId} value={m.membershipId}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {draft.type === 'move' && (
                <Select
                  value={draft.columnId}
                  onValueChange={(columnId) => update(draft.key, { columnId })}
                >
                  <SelectTrigger aria-label={`Coluna da ação ${index + 1}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {otherColumns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
          {drafts.length < 5 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="self-start">
                  <Plus />
                  Adicionar ação
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => add('send_message')}>
                  <MessageSquare />
                  Enviar mensagem
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => add('assign')}>
                  <UserRound />
                  Atribuir equipe/pessoa
                </DropdownMenuItem>
                {triggerType === 'card_idle' && otherColumns.length > 0 && (
                  <DropdownMenuItem onSelect={() => add('move')}>
                    <MoveRight />
                    Mover para outra coluna
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </fieldset>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="rule-enabled"
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(checked === true)}
        />
        <Label htmlFor="rule-enabled">Ativa</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={invalid || save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar automação'}
        </Button>
      </div>
    </form>
  )
}
