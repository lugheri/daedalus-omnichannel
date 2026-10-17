import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidSiteError } from './errors/invalid-site.error';

/** Um documento HTML de página única com CSS embutido cabe folgado nisso. */
export const MAX_TEMPLATE_HTML_LENGTH = 300_000;

export interface SiteTemplateDetails {
  name: string;
  niche: string | null;
  description: string | null;
  html: string;
}

export interface SiteTemplateProps extends SiteTemplateDetails {
  /** Conta que mantém o modelo (a da plataforma). */
  tenantId: string;
  /** As contas só escolhem modelos disponíveis; rascunho fica só com quem mantém. */
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Modelo de site: um documento HTML com marcadores Mustache que recebe o
 * conteúdo de cada conta ao publicar (ADR 0010). A sintaxe dos marcadores é
 * conferida na aplicação (pelo renderizador) antes de gravar.
 */
export class SiteTemplate extends AggregateRoot<SiteTemplateProps> {
  static create(id: string, input: SiteTemplateDetails & { tenantId: string }): SiteTemplate {
    const now = new Date();
    return new SiteTemplate(id, {
      ...validDetails(input),
      tenantId: input.tenantId,
      available: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(id: string, props: SiteTemplateProps): SiteTemplate {
    return new SiteTemplate(id, props);
  }

  /** Atualiza só o que veio (`niche`/`description` null = tira). */
  update(changes: Partial<SiteTemplateDetails> & { available?: boolean }): void {
    const { available, ...details } = changes;
    const next = { ...this.details };
    for (const [key, value] of Object.entries(details)) {
      if (value !== undefined) Object.assign(next, { [key]: value });
    }
    Object.assign(this.props, validDetails(next));
    if (available !== undefined) this.props.available = available;
    this.props.updatedAt = new Date();
  }

  private get details(): SiteTemplateDetails {
    const { name, niche, description, html } = this.props;
    return { name, niche, description, html };
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get name() {
    return this.props.name;
  }
  get niche() {
    return this.props.niche;
  }
  get description() {
    return this.props.description;
  }
  get html() {
    return this.props.html;
  }
  get available() {
    return this.props.available;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}

function validDetails(input: SiteTemplateDetails): SiteTemplateDetails {
  const name = input.name.trim();
  if (!name || name.length > 80) throw new InvalidSiteError('SITE_TEMPLATE_INVALID_NAME');
  if (!input.html.trim() || input.html.length > MAX_TEMPLATE_HTML_LENGTH) {
    throw new InvalidSiteError(
      'SITE_TEMPLATE_INVALID_HTML',
      'The template HTML is empty or too long',
    );
  }
  return {
    name,
    niche: input.niche?.trim().slice(0, 60) || null,
    description: input.description?.trim().slice(0, 300) || null,
    html: input.html,
  };
}
