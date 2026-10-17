import { Deal, DEAL_VALUE_MAX_CENTS } from './deal.entity';
import { InvalidDealError } from './errors/invalid-deal.error';
import { DealChangedEvent, DealClosedEvent, DealEnteredColumnEvent } from './events/kanban-events';

describe('Deal', () => {
  const open = (overrides: Partial<Parameters<typeof Deal.open>[1]> = {}) =>
    Deal.open(
      'deal-1',
      {
        tenantId: 't-1',
        boardId: 'b-1',
        columnId: 'col-1',
        contactId: 'contact-1',
        title: '  Venda   do kit ',
        position: 0,
        ...overrides,
      },
      'agent-1',
    );

  it('opens in the column, without conversation, owner or value by default', () => {
    const deal = open();
    expect(deal).toMatchObject({
      title: 'Venda do kit',
      status: 'open',
      conversationId: null,
      ownerId: null,
      valueCents: null,
    });
    expect(deal.pullEvents()).toEqual([
      expect.objectContaining({
        eventName: DealEnteredColumnEvent.eventName,
        contactId: 'contact-1',
        columnId: 'col-1',
        previousColumnId: null,
        movedBy: 'agent-1',
      }),
    ]);
  });

  it.each([
    [{ title: '   ' }, 'DEAL_INVALID_TITLE'],
    [{ title: 'x'.repeat(121) }, 'DEAL_INVALID_TITLE'],
    [{ valueCents: -1 }, 'DEAL_INVALID_VALUE'],
    [{ valueCents: 10.5 }, 'DEAL_INVALID_VALUE'],
    [{ valueCents: DEAL_VALUE_MAX_CENTS + 1 }, 'DEAL_INVALID_VALUE'],
  ])('refuses %j (%s)', (overrides, code) => {
    expect(() => open(overrides)).toThrow(expect.objectContaining({ code }) as Error);
  });

  it('another column restarts the time in it; the same column only repositions', () => {
    const deal = open();
    deal.pullEvents();
    const entered = deal.enteredColumnAt;

    deal.moveTo('col-1', 3, 'agent-1');
    expect(deal.enteredColumnAt).toBe(entered);
    expect(deal.pullEvents()).toEqual([expect.any(DealChangedEvent)]);

    deal.moveTo('col-2', 0, null);
    expect(deal.columnId).toBe('col-2');
    expect(deal.enteredColumnAt).not.toBe(entered);
    expect(deal.pullEvents()).toEqual([
      expect.objectContaining({ columnId: 'col-2', previousColumnId: 'col-1', movedBy: null }),
    ]);
  });

  it('edits title and value (null clears it), owner and conversation — one signal per operation', () => {
    const deal = open({ valueCents: 5000 });
    deal.pullEvents();

    deal.edit({ title: 'Novo título', valueCents: null });
    deal.setOwner('agent-2');
    deal.linkConversation('conv-1');

    expect(deal).toMatchObject({
      title: 'Novo título',
      valueCents: null,
      ownerId: 'agent-2',
      conversationId: 'conv-1',
    });
    expect(deal.pullEvents()).toEqual([expect.any(DealChangedEvent)]);
  });

  it('won leaves the board; a closed deal does not move, and reopens in the same column', () => {
    const deal = open({ valueCents: 9900 });
    deal.pullEvents();

    deal.win('agent-1');
    expect(deal.status).toBe('won');
    expect(deal.closedAt).not.toBeNull();
    expect(deal.pullEvents()).toEqual([
      expect.objectContaining({
        eventName: DealClosedEvent.eventName,
        status: 'won',
        valueCents: 9900,
        closedBy: 'agent-1',
      }),
    ]);
    expect(() => deal.moveTo('col-2', 0, null)).toThrow(InvalidDealError);
    expect(() => deal.lose(null, null)).toThrow(
      expect.objectContaining({ code: 'DEAL_NOT_OPEN' }) as Error,
    );

    deal.reopen();
    expect(deal).toMatchObject({ status: 'open', closedAt: null, columnId: 'col-1' });
    expect(() => deal.reopen()).toThrow(
      expect.objectContaining({ code: 'DEAL_NOT_CLOSED' }) as Error,
    );
  });

  it('lost keeps the reason (optional, trimmed, limited)', () => {
    const deal = open();
    expect(() => deal.lose('x'.repeat(501), null)).toThrow(
      expect.objectContaining({ code: 'DEAL_INVALID_LOST_REASON' }) as Error,
    );
    deal.lose('  Achou caro ', 'agent-1');
    expect(deal).toMatchObject({ status: 'lost', lostReason: 'Achou caro' });

    deal.reopen();
    expect(deal.lostReason).toBeNull();
    deal.lose('   ', null);
    expect(deal.lostReason).toBeNull();
  });
});
