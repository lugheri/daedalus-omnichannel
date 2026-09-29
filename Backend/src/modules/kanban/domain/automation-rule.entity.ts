import { Entity } from '../../../shared/domain/entity';
import { InvalidAutomationError } from './errors/invalid-automation.error';

/**
 * Gatilhos. Os três últimos são eventos da conversa: movem o card PARA a
 * coluna da regra (em cada quadro em que a conversa estiver).
 */
export type AutomationTrigger =
  | { type: 'card_entered' }
  | { type: 'card_idle'; minutes: number }
  | { type: 'disposition_set'; dispositionId: string }
  | { type: 'conversation_resolved' }
  | { type: 'customer_replied' };

export type TriggerType = AutomationTrigger['type'];

export const TRIGGER_TYPES: readonly TriggerType[] = [
  'card_entered',
  'card_idle',
  'disposition_set',
  'conversation_resolved',
  'customer_replied',
];

/** Gatilhos de evento da conversa: a ação é mover o card para a coluna da regra. */
export const MOVE_INTO_TRIGGERS: readonly TriggerType[] = [
  'disposition_set',
  'conversation_resolved',
  'customer_replied',
];

export type AutomationAction =
  /** Texto com {{nome}} (primeiro nome do contato) e {{nome_completo}}. */
  | { type: 'send_message'; text: string }
  /** Campo ausente = não muda; null = tira (fila geral / sem responsável). */
  | { type: 'assign'; teamId?: string | null; assigneeId?: string | null }
  /** Só no gatilho de tempo parado (entrada nunca move: evita laço entre colunas). */
  | { type: 'move'; columnId: string };

export const MAX_ACTIONS = 5;
export const MAX_MESSAGE = 2000;
/** 90 dias. */
export const MAX_IDLE_MINUTES = 90 * 24 * 60;

export interface AutomationRuleProps {
  tenantId: string;
  boardId: string;
  columnId: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  enabled: boolean;
  /** O tempo parado conta daqui (criação ou reativação). */
  activeSince: Date;
  createdAt: Date;
}

/**
 * Regra de automação de uma coluna. As referências (equipe, pessoa,
 * tabulação, coluna de destino) o use case confere; aqui ficam as regras de
 * formato e de combinação gatilho × ações.
 */
export class AutomationRule extends Entity<AutomationRuleProps> {
  static create(
    id: string,
    input: Pick<
      AutomationRuleProps,
      'tenantId' | 'boardId' | 'columnId' | 'trigger' | 'actions'
    > & {
      enabled?: boolean;
    },
  ): AutomationRule {
    const now = new Date();
    const trigger = validTrigger(input.trigger);
    return new AutomationRule(id, {
      tenantId: input.tenantId,
      boardId: input.boardId,
      columnId: input.columnId,
      trigger,
      actions: validActions(trigger, input.actions, input.columnId),
      enabled: input.enabled ?? true,
      activeSince: now,
      createdAt: now,
    });
  }

  static restore(id: string, props: AutomationRuleProps): AutomationRule {
    return new AutomationRule(id, props);
  }

  /** Mudar o gatilho ou reativar recomeça a contagem do tempo parado. */
  update(input: {
    trigger?: AutomationTrigger;
    actions?: AutomationAction[];
    enabled?: boolean;
  }): void {
    const trigger = input.trigger ? validTrigger(input.trigger) : this.props.trigger;
    const actions = validActions(trigger, input.actions ?? this.props.actions, this.props.columnId);
    const restart =
      (input.trigger && JSON.stringify(input.trigger) !== JSON.stringify(this.props.trigger)) ||
      (input.enabled === true && !this.props.enabled);
    this.props.trigger = trigger;
    this.props.actions = actions;
    if (input.enabled !== undefined) this.props.enabled = input.enabled;
    if (restart) this.props.activeSince = new Date();
  }

  /** Esta regra move o card para a própria coluna quando a conversa muda? */
  get movesInto(): boolean {
    return MOVE_INTO_TRIGGERS.includes(this.props.trigger.type);
  }

  /** Ela depende desta coluna (é dela ou move para ela)? */
  dependsOnColumn(columnId: string): boolean {
    return (
      this.props.columnId === columnId ||
      this.props.actions.some((a) => a.type === 'move' && a.columnId === columnId)
    );
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get boardId() {
    return this.props.boardId;
  }
  get columnId() {
    return this.props.columnId;
  }
  get trigger(): AutomationTrigger {
    return this.props.trigger;
  }
  get actions(): readonly AutomationAction[] {
    return this.props.actions;
  }
  get enabled() {
    return this.props.enabled;
  }
  get activeSince() {
    return this.props.activeSince;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}

function validTrigger(trigger: AutomationTrigger): AutomationTrigger {
  switch (trigger.type) {
    case 'card_idle':
      if (
        !Number.isInteger(trigger.minutes) ||
        trigger.minutes < 1 ||
        trigger.minutes > MAX_IDLE_MINUTES
      ) {
        throw new InvalidAutomationError('AUTOMATION_INVALID_IDLE_TIME');
      }
      return { type: 'card_idle', minutes: trigger.minutes };
    case 'disposition_set':
      if (!trigger.dispositionId) throw new InvalidAutomationError('AUTOMATION_INVALID_TRIGGER');
      return { type: 'disposition_set', dispositionId: trigger.dispositionId };
    case 'card_entered':
    case 'conversation_resolved':
    case 'customer_replied':
      return { type: trigger.type };
    default:
      throw new InvalidAutomationError('AUTOMATION_INVALID_TRIGGER');
  }
}

function validActions(
  trigger: AutomationTrigger,
  actions: readonly AutomationAction[],
  ownColumnId: string,
): AutomationAction[] {
  if (MOVE_INTO_TRIGGERS.includes(trigger.type)) {
    // A ação é implícita: mover o card para a coluna da regra.
    if (actions.length > 0) throw new InvalidAutomationError('AUTOMATION_INVALID_ACTIONS');
    return [];
  }
  if (actions.length === 0 || actions.length > MAX_ACTIONS) {
    throw new InvalidAutomationError('AUTOMATION_INVALID_ACTIONS');
  }
  return actions.map((action) => {
    switch (action.type) {
      case 'send_message': {
        const text = action.text.trim();
        if (text.length === 0 || text.length > MAX_MESSAGE) {
          throw new InvalidAutomationError('AUTOMATION_INVALID_MESSAGE');
        }
        return { type: 'send_message', text };
      }
      case 'assign':
        if (action.teamId === undefined && action.assigneeId === undefined) {
          throw new InvalidAutomationError('AUTOMATION_INVALID_ASSIGN');
        }
        return {
          type: 'assign',
          ...(action.teamId !== undefined && { teamId: action.teamId }),
          ...(action.assigneeId !== undefined && { assigneeId: action.assigneeId }),
        };
      case 'move':
        // Entrada nunca move (laço instantâneo entre colunas); nem para a própria coluna.
        if (trigger.type !== 'card_idle' || action.columnId === ownColumnId) {
          throw new InvalidAutomationError('AUTOMATION_INVALID_MOVE');
        }
        return { type: 'move', columnId: action.columnId };
      default:
        throw new InvalidAutomationError('AUTOMATION_INVALID_ACTIONS');
    }
  });
}
