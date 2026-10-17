import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { normalizeSiteContent, type SiteContent } from './site-content';
import { validSiteSlug } from './site-slug';

export type SitePendingAction = 'publish' | 'unpublish';

export interface SiteProps {
  tenantId: string;
  templateId: string;
  slug: string;
  content: SiteContent;
  /** Onde o site está no ar (null = fora do ar); difere do slug até publicar de novo. */
  publishedSlug: string | null;
  publishedAt: Date | null;
  /** O que o worker ainda vai fazer. */
  pendingAction: SitePendingAction | null;
  /** Código do motivo da última publicação que falhou. */
  lastError: string | null;
  createdAt: Date;
  /** Última edição (conteúdo, endereço ou modelo) — não muda ao publicar. */
  updatedAt: Date;
}

/**
 * O site de uma conta: conteúdo + modelo + endereço (`<slug>.SITES_DOMAIN`).
 * Editar mexe só no rascunho; o que está no ar muda quando o worker publica.
 */
export class Site extends AggregateRoot<SiteProps> {
  static create(
    id: string,
    input: { tenantId: string; templateId: string; slug: string; content: SiteContent },
  ): Site {
    const now = new Date();
    return new Site(id, {
      tenantId: input.tenantId,
      templateId: input.templateId,
      slug: validSiteSlug(input.slug),
      content: normalizeSiteContent(input.content),
      publishedSlug: null,
      publishedAt: null,
      pendingAction: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(id: string, props: SiteProps): Site {
    return new Site(id, props);
  }

  edit(changes: { content?: SiteContent; slug?: string; templateId?: string }): void {
    if (changes.content) this.props.content = normalizeSiteContent(changes.content);
    if (changes.slug !== undefined) this.props.slug = validSiteSlug(changes.slug);
    if (changes.templateId) this.props.templateId = changes.templateId;
    this.props.updatedAt = new Date();
  }

  requestPublish(): void {
    this.props.pendingAction = 'publish';
    this.props.lastError = null;
  }

  requestUnpublish(): void {
    this.props.pendingAction = 'unpublish';
    this.props.lastError = null;
  }

  markPublished(slug: string, at: Date): void {
    this.props.publishedSlug = slug;
    this.props.publishedAt = at;
    this.props.pendingAction = null;
    this.props.lastError = null;
  }

  markUnpublished(): void {
    this.props.publishedSlug = null;
    this.props.pendingAction = null;
    this.props.lastError = null;
  }

  markFailed(code: string): void {
    this.props.pendingAction = null;
    this.props.lastError = code;
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get templateId() {
    return this.props.templateId;
  }
  get slug() {
    return this.props.slug;
  }
  get content() {
    return this.props.content;
  }
  get publishedSlug() {
    return this.props.publishedSlug;
  }
  get publishedAt() {
    return this.props.publishedAt;
  }
  get pendingAction() {
    return this.props.pendingAction;
  }
  get lastError() {
    return this.props.lastError;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
  get isLive(): boolean {
    return this.props.publishedSlug !== null;
  }
  /** No ar, mas com edição depois da última publicação. */
  get hasUnpublishedChanges(): boolean {
    return (
      this.isLive &&
      (this.props.publishedAt === null || this.props.updatedAt > this.props.publishedAt)
    );
  }
}
