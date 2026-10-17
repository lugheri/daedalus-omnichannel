import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidDealError } from './errors/invalid-deal.error';
import { DealChangedEvent, DealClosedEvent, DealEnteredColumnEvent } from './events/kanban-events';

export const DEAL_TITLE_MAX = 120;
/** Limite do INTEGER em centavos (~R$ 21 milhões); acima disso é erro de digitação. */
export const DEAL_VALUE_MAX_CENTS = 2_000_000_000;
export const LOST_REASON_MAX = 500;

export type DealStatus = 'open' | 'won' | 'lost';

export interface DealProps {
  tenantId: string;
  boardId: string;
  columnId: string;
  contactId: string;
  /** Conversa ligada ao negócio; null = ninguém falou com o lead ainda. */
  conversationId: string | null;
  title: string;
  /** Centavos; null = sem valor definido. */
  valueCents: number | null;
  /** Responsável (membership); null = ninguém ainda. */
  ownerId: string | null;
  status: DealStatus;
  lostReason: string | null;
  closedAt: Date | null;
  /** Ordem na etapa (menor = mais acima); ver `positionBetween`. */
  position: number;
  enteredColumnAt: Date;
  createdAt: Date;
}

export type OpenDealInput = Pick<
  DealProps,
  'tenantId' | 'boardId' | 'columnId' | 'contactId' | 'title' | 'position'
> &
  Partial<Pick<DealProps, 'conversationId' | 'valueCents' | 'ownerId'>>;

/**
 * Negócio (oportunidade de venda) de um contato num funil. Em aberto ele fica
 * numa etapa; ganho ou perdido ele sai do funil (continua na ficha do
 * contato) e pode ser reaberto. Quem pode ver e mexer, o use case decide.
 */
export class Deal extends AggregateRoot<DealProps> {
  static open(id: string, input: OpenDealInput, by: string | null): Deal {
    const now = new Date();
    const deal = new Deal(id, {
      ...input,
      title: validTitle(input.title),
      conversationId: input.conversationId ?? null,
      valueCents: validValue(input.valueCents ?? null),
      ownerId: input.ownerId ?? null,
      status: 'open',
      lostReason: null,
      closedAt: null,
      enteredColumnAt: now,
      createdAt: now,
    });
    deal.entered(null, by);
    return deal;
  }

  static restore(id: string, props: DealProps): Deal {
    return new Deal(id, props);
  }

  /** Outra etapa = entrou nela agora (reinicia o "parado há"). */
  moveTo(columnId: string, position: number, by: string | null): void {
    this.assertOpen();
    const previous = this.props.columnId;
    this.props.position = position;
    if (previous === columnId) {
      this.changed();
      return;
    }
    this.props.columnId = columnId;
    this.props.enteredColumnAt = new Date();
    this.entered(previous, by);
  }

  /** Campo ausente = não muda; `valueCents: null` = tira o valor. */
  edit(input: { title?: string; valueCents?: number | null }): void {
    if (input.title !== undefined) this.props.title = validTitle(input.title);
    if (input.valueCents !== undefined) this.props.valueCents = validValue(input.valueCents);
    this.changed();
  }

  /** Se o membro está ativo, o use case confere. */
  setOwner(ownerId: string | null): void {
    if (this.props.ownerId === ownerId) return;
    this.props.ownerId = ownerId;
    this.changed();
  }

  /** Liga a conversa (do mesmo contato — o use case confere). */
  linkConversation(conversationId: string): void {
    if (this.props.conversationId === conversationId) return;
    this.props.conversationId = conversationId;
    this.changed();
  }

  win(by: string | null): void {
    this.close('won', null, by);
  }

  lose(reason: string | null, by: string | null): void {
    const text = reason?.trim() || null;
    if (text && text.length > LOST_REASON_MAX) {
      throw new InvalidDealError('DEAL_INVALID_LOST_REASON');
    }
    this.close('lost', text, by);
  }

  /** Volta para o funil, na mesma etapa (o "parado há" recomeça). */
  reopen(): void {
    if (this.props.status === 'open') throw new InvalidDealError('DEAL_NOT_CLOSED');
    this.props.status = 'open';
    this.props.lostReason = null;
    this.props.closedAt = null;
    this.props.enteredColumnAt = new Date();
    this.changed();
  }

  markRemoved(): void {
    this.addEvent(
      new DealChangedEvent(
        this.id,
        this.props.tenantId,
        this.props.boardId,
        this.props.contactId,
        true,
      ),
    );
  }

  get isOpen(): boolean {
    return this.props.status === 'open';
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
  get contactId() {
    return this.props.contactId;
  }
  get conversationId() {
    return this.props.conversationId;
  }
  get title() {
    return this.props.title;
  }
  get valueCents() {
    return this.props.valueCents;
  }
  get ownerId() {
    return this.props.ownerId;
  }
  get status() {
    return this.props.status;
  }
  get lostReason() {
    return this.props.lostReason;
  }
  get closedAt() {
    return this.props.closedAt;
  }
  get position() {
    return this.props.position;
  }
  get enteredColumnAt() {
    return this.props.enteredColumnAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }

  private close(status: 'won' | 'lost', reason: string | null, by: string | null): void {
    this.assertOpen();
    this.props.status = status;
    this.props.lostReason = reason;
    this.props.closedAt = new Date();
    this.addEvent(
      new DealClosedEvent(
        this.id,
        this.props.tenantId,
        this.props.boardId,
        this.props.contactId,
        status,
        this.props.valueCents,
        by,
      ),
    );
  }

  private assertOpen(): void {
    if (this.props.status !== 'open') throw new InvalidDealError('DEAL_NOT_OPEN');
  }

  private entered(previousColumnId: string | null, by: string | null): void {
    this.addEvent(
      new DealEnteredColumnEvent(
        this.id,
        this.props.tenantId,
        this.props.boardId,
        this.props.contactId,
        this.props.conversationId,
        this.props.columnId,
        previousColumnId,
        by,
      ),
    );
  }

  private changed(): void {
    // Um aviso por operação basta para as telas recarregarem.
    if (this.hasPendingEvents) return;
    this.addEvent(
      new DealChangedEvent(
        this.id,
        this.props.tenantId,
        this.props.boardId,
        this.props.contactId,
        false,
      ),
    );
  }
}

function validTitle(raw: string): string {
  const title = raw.trim().replace(/\s+/g, ' ');
  if (title.length === 0 || title.length > DEAL_TITLE_MAX) {
    throw new InvalidDealError('DEAL_INVALID_TITLE');
  }
  return title;
}

function validValue(cents: number | null): number | null {
  if (cents === null) return null;
  if (!Number.isInteger(cents) || cents < 0 || cents > DEAL_VALUE_MAX_CENTS) {
    throw new InvalidDealError('DEAL_INVALID_VALUE');
  }
  return cents;
}
