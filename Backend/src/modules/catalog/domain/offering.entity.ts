import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { defined } from './defined';
import { InvalidCatalogItemError } from './errors/invalid-catalog-item.error';

export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 720;
/** R$ 100.000,00 — acima disso é erro de digitação, não preço de serviço. */
export const MAX_PRICE_CENTS = 10_000_000;

export interface OfferingDetails {
  name: string;
  description: string | null;
  durationMinutes: number;
  /** Centavos; null = "sob consulta". */
  priceCents: number | null;
  showOnSite: boolean;
}

export interface OfferingProps extends OfferingDetails {
  tenantId: string;
  /** Inativo: fora das opções novas (agenda, site), mas continua no histórico. */
  active: boolean;
  createdAt: Date;
}

/**
 * Serviço que o negócio oferece (corte, consulta, instalação...). "Offering"
 * no código para não confundir com os services do Nest; na API e na tela é
 * "serviço". A duração é o tempo que ele ocupa na agenda.
 */
export class Offering extends AggregateRoot<OfferingProps> {
  static create(id: string, input: OfferingDetails & { tenantId: string }): Offering {
    return new Offering(id, {
      ...validDetails(input),
      tenantId: input.tenantId,
      active: true,
      createdAt: new Date(),
    });
  }

  static restore(id: string, props: OfferingProps): Offering {
    return new Offering(id, props);
  }

  /** Atualiza só o que veio; o resultado inteiro é validado. */
  update(changes: Partial<OfferingDetails> & { active?: boolean }): void {
    const { active, ...details } = changes;
    Object.assign(this.props, validDetails({ ...this.details, ...defined(details) }));
    if (active !== undefined) this.props.active = active;
  }

  private get details(): OfferingDetails {
    const { name, description, durationMinutes, priceCents, showOnSite } = this.props;
    return { name, description, durationMinutes, priceCents, showOnSite };
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get name() {
    return this.props.name;
  }
  get description() {
    return this.props.description;
  }
  get durationMinutes() {
    return this.props.durationMinutes;
  }
  get priceCents() {
    return this.props.priceCents;
  }
  get showOnSite() {
    return this.props.showOnSite;
  }
  get active() {
    return this.props.active;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}

function validDetails(input: OfferingDetails): OfferingDetails {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80)
    throw new InvalidCatalogItemError('SERVICE_INVALID_NAME');

  const description = input.description?.trim() || null;
  if (description && description.length > 1000) {
    throw new InvalidCatalogItemError('SERVICE_INVALID_DESCRIPTION');
  }

  const { durationMinutes, priceCents } = input;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    throw new InvalidCatalogItemError('SERVICE_INVALID_DURATION');
  }
  if (
    priceCents !== null &&
    (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > MAX_PRICE_CENTS)
  ) {
    throw new InvalidCatalogItemError('SERVICE_INVALID_PRICE');
  }

  return { name, description, durationMinutes, priceCents, showOnSite: input.showOnSite };
}
