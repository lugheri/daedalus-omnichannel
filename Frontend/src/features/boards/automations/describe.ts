import type { AutomationAction, AutomationTrigger } from './api'

/** Nomes para descrever uma regra em português. */
export interface Names {
  column: (id: string) => string | undefined
  team: (id: string) => string | undefined
  member: (id: string) => string | null
  disposition: (id: string) => string | undefined
}

/** "30 minutos", "2 horas", "3 dias" (usa a maior unidade exata). */
export function durationLabel(minutes: number): string {
  if (minutes % 1440 === 0) return plural(minutes / 1440, 'dia', 'dias')
  if (minutes % 60 === 0) return plural(minutes / 60, 'hora', 'horas')
  return plural(minutes, 'minuto', 'minutos')
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function describeTrigger(trigger: AutomationTrigger, names: Names): string {
  switch (trigger.type) {
    case 'card_entered':
      return 'Quando o card entrar nesta coluna'
    case 'card_idle':
      return `Quando o card ficar parado aqui por ${durationLabel(trigger.minutes)}`
    case 'disposition_set':
      return `Quando a conversa for tabulada como “${names.disposition(trigger.dispositionId) ?? 'tabulação removida'}”, mover para cá`
    case 'conversation_resolved':
      return 'Quando a conversa for resolvida, mover para cá'
    case 'customer_replied':
      return 'Quando o cliente responder, mover para cá'
  }
}

export function describeAction(action: AutomationAction, names: Names): string {
  switch (action.type) {
    case 'send_message':
      return `Enviar mensagem: “${action.text.length > 60 ? `${action.text.slice(0, 60)}…` : action.text}”`
    case 'move':
      return `Mover para “${names.column(action.columnId) ?? 'coluna removida'}”`
    case 'assign': {
      const parts: string[] = []
      if (action.teamId !== undefined) {
        parts.push(
          action.teamId === null
            ? 'fila geral'
            : `equipe ${names.team(action.teamId) ?? '(removida)'}`,
        )
      }
      if (action.assigneeId !== undefined) {
        parts.push(
          action.assigneeId === null
            ? 'sem responsável'
            : (names.member(action.assigneeId) ?? 'ex-membro'),
        )
      }
      return `Atribuir: ${parts.join(', ')}`
    }
  }
}

/** Motivos de uma ação que falhou ou foi pulada (códigos do backend). */
export const RESULT_LABELS: Record<string, string> = {
  CARD_ALREADY_MOVED: 'pulada: o card já tinha saído da coluna',
  ALREADY_IN_COLUMN: 'pulada: o card já estava na coluna',
  CARD_REMOVED: 'pulada: o card foi removido do quadro',
  UNEXPECTED: 'erro inesperado',
}
