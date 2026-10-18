import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidSiteError } from './errors/invalid-site.error';
import { SiteNotFoundError } from './errors/site-not-found.error';
import { normalizeLandingContent, type LandingContent } from './landing-content';
import type { SitePendingAction } from './site.entity';

export const MAX_VARIANTS = 4;
/** A letra é a pasta da variante durante o teste (`<path>/b/`). */
export const VARIANT_CODES = ['a', 'b', 'c', 'd'] as const;
export type VariantCode = (typeof VARIANT_CODES)[number];
export const MAX_WEIGHT = 100;

/** Mesmo formato de um pedaço de URL simples: minúsculas, números e hífen. */
const PATH = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export function validLandingPath(raw: string): string {
  const path = raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '');
  if (!PATH.test(path)) throw new InvalidSiteError('LANDING_INVALID_PATH');
  return path;
}

function validName(raw: string): string {
  const name = raw.trim();
  if (!name || name.length > 80) throw new InvalidSiteError('LANDING_INVALID_NAME');
  return name;
}

export interface LandingVariant {
  id: string;
  code: VariantCode;
  name: string;
  templateId: string;
  content: LandingContent;
  /** Peso na divisão do tráfego; 0 = fora do teste. */
  weight: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LandingPageProps {
  tenantId: string;
  name: string;
  path: string;
  formId: string | null;
  variants: LandingVariant[];
  pendingAction: SitePendingAction | null;
  lastError: string | null;
  publishedAt: Date | null;
  /** Pastas do bucket onde está no ar (o slug do site e, se houver, o domínio). */
  publishedFolders: string[];
  /** Caminho no ar (null = fora do ar); difere do `path` até publicar de novo. */
  publishedPath: string | null;
  /** Letras das pastas de variante gravadas sob o caminho no ar. */
  publishedCodes: string[];
  createdAt: Date;
  /** Última edição (página ou variantes) — não muda ao publicar. */
  updatedAt: Date;
}

/**
 * Landing page de campanha (ADR 0014): mora num caminho do site da conta e
 * tem de 1 a 4 variantes (modelo + conteúdo + peso). Com mais de uma variante
 * com peso, há teste A/B: o tráfego se divide pelos pesos. Escolher o
 * vencedor deixa só ele no ar. Editar mexe no rascunho; o ar muda ao publicar.
 */
export class LandingPage extends AggregateRoot<LandingPageProps> {
  static create(
    id: string,
    input: {
      tenantId: string;
      name: string;
      path: string;
      formId: string | null;
      firstVariant: { id: string; templateId: string; content: LandingContent };
    },
  ): LandingPage {
    const now = new Date();
    return new LandingPage(id, {
      tenantId: input.tenantId,
      name: validName(input.name),
      path: validLandingPath(input.path),
      formId: input.formId,
      variants: [
        {
          id: input.firstVariant.id,
          code: 'a',
          name: 'Variante A',
          templateId: input.firstVariant.templateId,
          content: normalizeLandingContent(input.firstVariant.content),
          weight: 50,
          createdAt: now,
          updatedAt: now,
        },
      ],
      pendingAction: null,
      lastError: null,
      publishedAt: null,
      publishedFolders: [],
      publishedPath: null,
      publishedCodes: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(id: string, props: LandingPageProps): LandingPage {
    return new LandingPage(id, props);
  }

  edit(changes: { name?: string; path?: string; formId?: string | null }): void {
    if (changes.name !== undefined) this.props.name = validName(changes.name);
    if (changes.path !== undefined) this.props.path = validLandingPath(changes.path);
    if (changes.formId !== undefined) this.props.formId = changes.formId;
    this.touch();
  }

  /** Nova variante (cópia de outra), com a primeira letra livre e o mesmo peso das outras. */
  addVariant(id: string, from: LandingVariant): LandingVariant {
    if (this.props.variants.length >= MAX_VARIANTS) {
      throw new InvalidSiteError('LANDING_TOO_MANY_VARIANTS');
    }
    const used = new Set(this.props.variants.map((v) => v.code));
    const code = VARIANT_CODES.find((c) => !used.has(c))!;
    const now = new Date();
    const variant: LandingVariant = {
      id,
      code,
      name: `Variante ${code.toUpperCase()}`,
      templateId: from.templateId,
      content: structuredClone(from.content),
      weight: 50,
      createdAt: now,
      updatedAt: now,
    };
    this.props.variants.push(variant);
    this.touch();
    return variant;
  }

  updateVariant(
    id: string,
    changes: { name?: string; templateId?: string; content?: LandingContent; weight?: number },
  ): LandingVariant {
    const variant = this.variant(id);
    if (changes.name !== undefined) variant.name = validName(changes.name);
    if (changes.templateId !== undefined) variant.templateId = changes.templateId;
    if (changes.content !== undefined) variant.content = normalizeLandingContent(changes.content);
    if (changes.weight !== undefined) {
      if (!Number.isInteger(changes.weight) || changes.weight < 0 || changes.weight > MAX_WEIGHT) {
        throw new InvalidSiteError('LANDING_INVALID_WEIGHT');
      }
      variant.weight = changes.weight;
      this.assertSomeActive();
    }
    variant.updatedAt = new Date();
    this.touch();
    return variant;
  }

  removeVariant(id: string): void {
    this.variant(id);
    if (this.props.variants.length === 1) throw new InvalidSiteError('LANDING_LAST_VARIANT');
    this.props.variants = this.props.variants.filter((v) => v.id !== id);
    // Tirou a única com peso: a primeira que sobrou assume.
    if (this.activeVariants.length === 0) this.props.variants[0].weight = MAX_WEIGHT;
    this.touch();
  }

  /** Fim do teste: só o vencedor fica com tráfego (as outras ficam guardadas, com peso 0). */
  chooseWinner(id: string): void {
    this.variant(id);
    for (const v of this.props.variants) v.weight = v.id === id ? MAX_WEIGHT : 0;
    this.touch();
  }

  variant(id: string): LandingVariant {
    const found = this.props.variants.find((v) => v.id === id);
    if (!found) throw new SiteNotFoundError('LANDING_VARIANT_NOT_FOUND');
    return found;
  }

  requestPublish(): void {
    this.props.pendingAction = 'publish';
    this.props.lastError = null;
  }

  requestUnpublish(): void {
    this.props.pendingAction = 'unpublish';
    this.props.lastError = null;
  }

  markPublished(at: { folders: string[]; path: string; codes: string[]; startedAt: Date }): void {
    this.props.publishedFolders = at.folders;
    this.props.publishedPath = at.path;
    this.props.publishedCodes = at.codes;
    this.props.publishedAt = at.startedAt;
    this.props.pendingAction = null;
    this.props.lastError = null;
  }

  markUnpublished(): void {
    this.props.publishedFolders = [];
    this.props.publishedPath = null;
    this.props.publishedCodes = [];
    this.props.pendingAction = null;
    this.props.lastError = null;
  }

  markFailed(code: string): void {
    this.props.pendingAction = null;
    this.props.lastError = code;
  }

  private assertSomeActive(): void {
    if (this.activeVariants.length === 0) throw new InvalidSiteError('LANDING_NO_ACTIVE_VARIANT');
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get name() {
    return this.props.name;
  }
  get path() {
    return this.props.path;
  }
  get formId() {
    return this.props.formId;
  }
  get variants(): readonly LandingVariant[] {
    return this.props.variants;
  }
  /** As variantes com tráfego, na ordem das letras. */
  get activeVariants(): LandingVariant[] {
    return this.props.variants
      .filter((v) => v.weight > 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  }
  /** Mais de uma variante com tráfego: há teste A/B. */
  get isTesting(): boolean {
    return this.activeVariants.length > 1;
  }
  get pendingAction() {
    return this.props.pendingAction;
  }
  get lastError() {
    return this.props.lastError;
  }
  get publishedAt() {
    return this.props.publishedAt;
  }
  get publishedFolders() {
    return this.props.publishedFolders;
  }
  get publishedPath() {
    return this.props.publishedPath;
  }
  get publishedCodes() {
    return this.props.publishedCodes;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
  get isLive(): boolean {
    return this.props.publishedPath !== null;
  }
  get hasUnpublishedChanges(): boolean {
    return (
      this.isLive &&
      (this.props.publishedAt === null || this.props.updatedAt > this.props.publishedAt)
    );
  }
}
