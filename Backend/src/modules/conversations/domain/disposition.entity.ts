import { Entity } from '../../../shared/domain/entity';
import { InvalidDispositionError } from './errors/invalid-disposition.error';

/** Cores das etiquetas (a tela mapeia cada uma para o seu tom). */
export const DISPOSITION_COLORS = [
  'gray',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
] as const;
export type DispositionColor = (typeof DISPOSITION_COLORS)[number];

export const DISPOSITION_NAME_MAX = 60;

export interface DispositionProps {
  tenantId: string;
  name: string;
  color: DispositionColor;
  /** Arquivada: some das opções, mas continua no histórico de quem a usou. */
  archivedAt: Date | null;
  createdAt: Date;
}

/**
 * Tabulação: o desfecho (ou etapa) de um atendimento — "Venda realizada",
 * "Sem interesse" etc. Cada conta cria as suas.
 */
export class Disposition extends Entity<DispositionProps> {
  static create(
    id: string,
    input: { tenantId: string; name: string; color: DispositionColor },
  ): Disposition {
    return new Disposition(id, {
      tenantId: input.tenantId,
      name: validName(input.name),
      color: validColor(input.color),
      archivedAt: null,
      createdAt: new Date(),
    });
  }

  static restore(id: string, props: DispositionProps): Disposition {
    return new Disposition(id, props);
  }

  update(input: { name?: string; color?: DispositionColor }): void {
    if (input.name !== undefined) this.props.name = validName(input.name);
    if (input.color !== undefined) this.props.color = validColor(input.color);
  }

  archive(): void {
    this.props.archivedAt ??= new Date();
  }

  unarchive(): void {
    this.props.archivedAt = null;
  }

  get isActive() {
    return this.props.archivedAt === null;
  }
  get tenantId() {
    return this.props.tenantId;
  }
  get name() {
    return this.props.name;
  }
  get color() {
    return this.props.color;
  }
  get archivedAt() {
    return this.props.archivedAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}

function validName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0 || name.length > DISPOSITION_NAME_MAX) {
    throw new InvalidDispositionError('name');
  }
  return name;
}

function validColor(color: string): DispositionColor {
  if (!(DISPOSITION_COLORS as readonly string[]).includes(color)) {
    throw new InvalidDispositionError('color');
  }
  return color as DispositionColor;
}
