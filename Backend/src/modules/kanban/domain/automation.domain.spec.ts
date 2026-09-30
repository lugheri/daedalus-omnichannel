import {
  AutomationRule,
  type AutomationAction,
  type AutomationTrigger,
} from './automation-rule.entity';
import { renderTemplate } from '../../../shared/domain/message-template';

const rule = (trigger: AutomationTrigger, actions: AutomationAction[]) =>
  AutomationRule.create('r-1', {
    tenantId: 't',
    boardId: 'b',
    columnId: 'col-a',
    trigger,
    actions,
  });

/** O código do erro de domínio que a função lança. */
function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

const hello: AutomationAction = { type: 'send_message', text: 'Olá {{nome}}!' };

describe('AutomationRule', () => {
  it('entering a column: message and assignment, never a move (no instant loops)', () => {
    expect(
      rule({ type: 'card_entered' }, [hello, { type: 'assign', teamId: 't-1' }]).actions,
    ).toHaveLength(2);
    expect(
      codeOf(() => rule({ type: 'card_entered' }, [{ type: 'move', columnId: 'col-b' }])),
    ).toBe('AUTOMATION_INVALID_MOVE');
    expect(codeOf(() => rule({ type: 'card_entered' }, []))).toBe('AUTOMATION_INVALID_ACTIONS');
  });

  it('idle time can move, but not to its own column; minutes within 1 min – 90 days', () => {
    const idle = (minutes: number, actions: AutomationAction[]) =>
      rule({ type: 'card_idle', minutes }, actions);
    expect(idle(60, [{ type: 'move', columnId: 'col-b' }]).actions).toEqual([
      { type: 'move', columnId: 'col-b' },
    ]);
    expect(codeOf(() => idle(60, [{ type: 'move', columnId: 'col-a' }]))).toBe(
      'AUTOMATION_INVALID_MOVE',
    );
    expect(codeOf(() => idle(0, [hello]))).toBe('AUTOMATION_INVALID_IDLE_TIME');
    expect(codeOf(() => idle(90 * 24 * 60 + 1, [hello]))).toBe('AUTOMATION_INVALID_IDLE_TIME');
    expect(codeOf(() => idle(1.5, [hello]))).toBe('AUTOMATION_INVALID_IDLE_TIME');
  });

  it('conversation events move INTO the column: no actions of their own', () => {
    const byDisposition = rule({ type: 'disposition_set', dispositionId: 'd-1' }, []);
    expect(byDisposition.movesInto).toBe(true);
    expect(codeOf(() => rule({ type: 'customer_replied' }, [hello]))).toBe(
      'AUTOMATION_INVALID_ACTIONS',
    );
  });

  it('validates messages and assignments', () => {
    expect(
      codeOf(() => rule({ type: 'card_entered' }, [{ type: 'send_message', text: '  ' }])),
    ).toBe('AUTOMATION_INVALID_MESSAGE');
    expect(
      codeOf(() =>
        rule({ type: 'card_entered' }, [{ type: 'send_message', text: 'x'.repeat(2001) }]),
      ),
    ).toBe('AUTOMATION_INVALID_MESSAGE');
    expect(codeOf(() => rule({ type: 'card_entered' }, [{ type: 'assign' }]))).toBe(
      'AUTOMATION_INVALID_ASSIGN',
    );
    // null = tirar o responsável (volta para a fila): é uma atribuição válida.
    expect(rule({ type: 'card_entered' }, [{ type: 'assign', assigneeId: null }]).actions).toEqual([
      { type: 'assign', assigneeId: null },
    ]);
  });

  it('changing the trigger or re-enabling restarts the idle count; editing actions does not', () => {
    const r = rule({ type: 'card_idle', minutes: 60 }, [hello]);
    const since = r.activeSince;
    const later = () => new Promise((res) => setTimeout(res, 5));

    return later().then(async () => {
      r.update({ actions: [{ type: 'send_message', text: 'Oi' }] });
      expect(r.activeSince).toBe(since);

      r.update({ enabled: false });
      r.update({ enabled: true });
      expect(r.activeSince.getTime()).toBeGreaterThan(since.getTime());

      const reenabled = r.activeSince;
      await later();
      r.update({ trigger: { type: 'card_idle', minutes: 120 } });
      expect(r.activeSince.getTime()).toBeGreaterThan(reenabled.getTime());
    });
  });

  it('knows which columns it depends on', () => {
    const r = rule({ type: 'card_idle', minutes: 5 }, [{ type: 'move', columnId: 'col-b' }]);
    expect(r.dependsOnColumn('col-a')).toBe(true);
    expect(r.dependsOnColumn('col-b')).toBe(true);
    expect(r.dependsOnColumn('col-c')).toBe(false);
  });
});

describe('renderTemplate', () => {
  it('fills the first or full name', () => {
    expect(renderTemplate('Olá {{nome}}, tudo bem?', { name: '  Maria  da Silva ' })).toBe(
      'Olá Maria, tudo bem?',
    );
    expect(renderTemplate('Cliente: {{ nome_completo }}.', { name: 'Maria da Silva' })).toBe(
      'Cliente: Maria da Silva.',
    );
  });

  it('without a name the variable disappears and the punctuation is fixed', () => {
    expect(renderTemplate('Olá {{nome}}, tudo bem?', { name: null })).toBe('Olá, tudo bem?');
    expect(renderTemplate('Oi {{nome}}!', { name: null })).toBe('Oi!');
    expect(renderTemplate('Ainda tem interesse, {{nome}}?', { name: null })).toBe(
      'Ainda tem interesse?',
    );
    expect(renderTemplate('{{nome}}, seu pedido saiu.', { name: null })).toBe('seu pedido saiu.');
    // Com nome, a vírgula fica.
    expect(renderTemplate('Ainda tem interesse, {{nome}}?', { name: 'Ana' })).toBe(
      'Ainda tem interesse, Ana?',
    );
    expect(renderTemplate('{{nome}} obrigado pelo contato', { name: '' })).toBe(
      'obrigado pelo contato',
    );
  });
});
