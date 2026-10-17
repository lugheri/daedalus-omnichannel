import type { TenantContext } from '../../../shared/application/tenant-context';
import type { SiteAssetRepository } from '../application/ports/site-asset.repository';
import type { SiteDomainChecker } from '../application/ports/site-domain-checker';
import type { SiteHosting } from '../application/ports/site-hosting';
import type { SiteRenderer } from '../application/ports/site-renderer';
import type {
  SiteAccount,
  SiteFormInfo,
  SiteProfessionalItem,
  SiteServiceItem,
  SiteSources,
} from '../application/ports/site-sources';
import type { SiteTemplateRepository } from '../application/ports/site-template.repository';
import type { SiteRepository } from '../application/ports/site.repository';
import { InvalidSiteError } from '../domain/errors/invalid-site.error';
import { SiteConflictError } from '../domain/errors/site-conflict.error';
import type { SiteAsset } from '../domain/site-asset';
import { SiteTemplate } from '../domain/site-template.entity';
import { Site, type SiteProps } from '../domain/site.entity';

const copyTemplate = (t: SiteTemplate) =>
  SiteTemplate.restore(t.id, {
    tenantId: t.tenantId,
    name: t.name,
    niche: t.niche,
    description: t.description,
    html: t.html,
    available: t.available,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  });

const propsOf = (s: Site): SiteProps => ({
  tenantId: s.tenantId,
  templateId: s.templateId,
  slug: s.slug,
  content: structuredClone(s.content),
  publishedSlug: s.publishedSlug,
  publishedAt: s.publishedAt,
  pendingAction: s.pendingAction,
  lastError: s.lastError,
  customDomain: s.customDomain,
  publishedDomain: s.publishedDomain,
  domainStatus: s.domainStatus,
  domainCheckedAt: s.domainCheckedAt,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

/** Como o real: o que é "da conta" filtra pelo tenant; o resto vê todas. */
export class InMemorySiteTemplateRepository implements SiteTemplateRepository {
  items: SiteTemplate[] = [];

  constructor(
    private readonly tenant: TenantContext,
    private readonly sites?: InMemorySiteRepository,
  ) {}

  save(template: SiteTemplate): Promise<void> {
    this.items = [...this.items.filter((t) => t.id !== template.id), copyTemplate(template)];
    return Promise.resolve();
  }

  findOwned(id: string): Promise<SiteTemplate | null> {
    const found = this.items.find((t) => t.id === id && t.tenantId === this.tenant.tenantId);
    return Promise.resolve(found ? copyTemplate(found) : null);
  }

  listOwned(): Promise<SiteTemplate[]> {
    return Promise.resolve(
      this.items
        .filter((t) => t.tenantId === this.tenant.tenantId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(copyTemplate),
    );
  }

  delete(template: SiteTemplate): Promise<void> {
    this.items = this.items.filter((t) => t.id !== template.id);
    return Promise.resolve();
  }

  findForSite(id: string): Promise<SiteTemplate | null> {
    const found = this.items.find((t) => t.id === id);
    return Promise.resolve(found ? copyTemplate(found) : null);
  }

  listAvailable(): Promise<SiteTemplate[]> {
    return Promise.resolve(
      this.items
        .filter((t) => t.available)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(copyTemplate),
    );
  }

  countSitesUsing(id: string): Promise<number> {
    return Promise.resolve(this.sites?.all.filter((s) => s.templateId === id).length ?? 0);
  }
}

/** Como o real: `save` grava só a edição em site existente; `savePublication`, só o estado. */
export class InMemorySiteRepository implements SiteRepository {
  private rows = new Map<string, SiteProps>();

  constructor(private readonly tenant: TenantContext) {}

  get all(): Site[] {
    return [...this.rows.entries()].map(([id, props]) => Site.restore(id, { ...props }));
  }

  save(site: Site): Promise<void> {
    const others = [...this.rows.entries()].filter(([id]) => id !== site.id);
    if (others.some(([, p]) => p.slug === site.slug || p.publishedSlug === site.slug)) {
      throw new SiteConflictError('SITE_SLUG_TAKEN');
    }
    if (others.some(([, p]) => p.tenantId === site.tenantId)) {
      throw new SiteConflictError('SITE_ALREADY_EXISTS');
    }
    if (site.customDomain && others.some(([, p]) => p.customDomain === site.customDomain)) {
      throw new SiteConflictError('SITE_DOMAIN_TAKEN');
    }
    const current = this.rows.get(site.id);
    const next = propsOf(site);
    this.rows.set(
      site.id,
      current
        ? {
            ...current,
            templateId: next.templateId,
            slug: next.slug,
            content: next.content,
            customDomain: next.customDomain,
            updatedAt: next.updatedAt,
          }
        : next,
    );
    return Promise.resolve();
  }

  savePublication(site: Site): Promise<void> {
    const current = this.rows.get(site.id);
    if (current && current.tenantId === this.tenant.tenantId) {
      this.rows.set(site.id, {
        ...current,
        publishedSlug: site.publishedSlug,
        publishedDomain: site.publishedDomain,
        publishedAt: site.publishedAt,
        pendingAction: site.pendingAction,
        lastError: site.lastError,
      });
    }
    return Promise.resolve();
  }

  saveDomainStatus(site: Site): Promise<void> {
    const current = this.rows.get(site.id);
    if (current && current.customDomain === site.customDomain) {
      this.rows.set(site.id, {
        ...current,
        domainStatus: site.domainStatus,
        domainCheckedAt: site.domainCheckedAt,
      });
    }
    return Promise.resolve();
  }

  isDomainTaken(domains: string[], exceptSiteId: string): Promise<boolean> {
    return Promise.resolve(
      this.all.some(
        (s) =>
          s.id !== exceptSiteId &&
          domains.some((d) => d === s.customDomain || d === s.publishedDomain),
      ),
    );
  }

  findCurrent(): Promise<Site | null> {
    return Promise.resolve(this.all.find((s) => s.tenantId === this.tenant.tenantId) ?? null);
  }

  findById(id: string): Promise<Site | null> {
    return Promise.resolve(
      this.all.find((s) => s.id === id && s.tenantId === this.tenant.tenantId) ?? null,
    );
  }

  isSlugTaken(slug: string, exceptSiteId: string | null): Promise<boolean> {
    return Promise.resolve(
      this.all.some((s) => s.id !== exceptSiteId && (s.slug === slug || s.publishedSlug === slug)),
    );
  }
}

export class InMemorySiteAssetRepository implements SiteAssetRepository {
  items: SiteAsset[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((a) => a.tenantId === this.tenant.tenantId);
  }

  save(asset: SiteAsset): Promise<void> {
    this.items.push({ ...asset });
    return Promise.resolve();
  }

  findById(id: string): Promise<SiteAsset | null> {
    return Promise.resolve(this.ofTenant().find((a) => a.id === id) ?? null);
  }

  findByIds(ids: string[]): Promise<SiteAsset[]> {
    return Promise.resolve(this.ofTenant().filter((a) => ids.includes(a.id)));
  }

  list(): Promise<SiteAsset[]> {
    return Promise.resolve(
      [...this.ofTenant()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  }

  delete(asset: SiteAsset): Promise<void> {
    this.items = this.items.filter((a) => a.id !== asset.id);
    return Promise.resolve();
  }
}

/** Bucket de sites em memória; `failing` simula o S3 fora do ar. */
export class InMemorySiteHosting implements SiteHosting {
  readonly pages = new Map<string, string>();
  /** `<pasta>/<caminho>` → conteúdo. */
  readonly files = new Map<string, string>();
  readonly sitesDomain = 'sites.test';
  readonly domainTarget = 'tunel.cfargotunnel.com';
  readonly media = new Map<string, { body: Buffer; contentType: string }>();
  failing = false;

  constructor(readonly enabled = true) {}

  siteUrl(slug: string): string {
    return `https://${slug}.sites.test`;
  }

  domainUrl(host: string): string {
    return `https://${host}`;
  }

  publishFile(folder: string, path: string, body: string): Promise<void> {
    this.files.set(`${folder}/${path}`, body);
    return Promise.resolve();
  }

  removeFile(folder: string, path: string): Promise<void> {
    this.files.delete(`${folder}/${path}`);
    return Promise.resolve();
  }

  mediaUrl(key: string): string {
    return `https://media.sites.test/${key}`;
  }

  publishPage(slug: string, html: string): Promise<void> {
    if (this.failing) return Promise.reject(new Error('S3 down'));
    this.pages.set(slug, html);
    return Promise.resolve();
  }

  removePage(slug: string): Promise<void> {
    if (this.failing) return Promise.reject(new Error('S3 down'));
    this.pages.delete(slug);
    return Promise.resolve();
  }

  putMedia(key: string, body: Buffer, contentType: string): Promise<void> {
    this.media.set(key, { body, contentType });
    return Promise.resolve();
  }

  removeMedia(key: string): Promise<void> {
    this.media.delete(key);
    return Promise.resolve();
  }
}

/**
 * Renderizador de teste: devolve o "view" em JSON, para o teste ver o que o
 * modelo receberia. `{{bad` no modelo simula modelo com erro.
 */
export class JsonSiteRenderer implements SiteRenderer {
  check(html: string): string | null {
    return html.includes('{{bad') ? 'Unclosed tag at 0' : null;
  }

  render(html: string, view: object): string {
    const problem = this.check(html);
    if (problem) throw new InvalidSiteError('SITE_TEMPLATE_INVALID_HTML', problem);
    return JSON.stringify(view);
  }
}

export class FakeSiteSources implements SiteSources {
  serviceItems: SiteServiceItem[] = [];
  professionalItems: SiteProfessionalItem[] = [];
  forms = new Map<string, SiteFormInfo>();

  services(): Promise<SiteServiceItem[]> {
    return Promise.resolve(this.serviceItems);
  }

  professionals(): Promise<SiteProfessionalItem[]> {
    return Promise.resolve(this.professionalItems);
  }

  form(id: string): Promise<SiteFormInfo | null> {
    return Promise.resolve(this.forms.get(id) ?? null);
  }
}

/** Domínios que "chegam" no site (o resto não responde). */
export class FakeSiteDomainChecker implements SiteDomainChecker {
  constructor(private readonly hosting: InMemorySiteHosting) {}

  /** Como na vida real: chega se o arquivo publicado na pasta do domínio confere. */
  reachable = new Set<string>();

  reaches(domain: string, path: string, expected: string): Promise<boolean> {
    return Promise.resolve(
      this.reachable.has(domain) && this.hosting.files.get(`${domain}/${path}`) === expected,
    );
  }
}

/** Contas do teste por tenant (nome, slug e se é a raiz). */
export class FakeSiteAccount implements SiteAccount {
  /** O ator entrou como acesso da conta-mãe. */
  acting = false;

  constructor(
    private readonly tenant: TenantContext,
    readonly accounts: Record<string, { name: string; slug: string; isRoot: boolean }>,
  ) {}

  current() {
    const account = this.accounts[this.tenant.tenantId];
    if (!account) throw new Error(`No account ${this.tenant.tenantId}`);
    return Promise.resolve(account);
  }

  actingFromParentAccount(): Promise<boolean> {
    return Promise.resolve(this.acting);
  }
}
