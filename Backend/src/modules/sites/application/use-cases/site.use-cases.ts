import { Inject, Injectable, Logger } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { JOB_QUEUE, type JobQueue } from '../../../../shared/application/job-queue';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { InvalidSiteError } from '../../domain/errors/invalid-site.error';
import { SiteConflictError } from '../../domain/errors/site-conflict.error';
import { SiteDomainManagedAboveError } from '../../domain/errors/site-domain-managed-above.error';
import { SiteNotFoundError } from '../../domain/errors/site-not-found.error';
import {
  defaultSiteContent,
  normalizeSiteContent,
  referencedAssetIds,
  type SiteContent,
} from '../../domain/site-content';
import { domainVariants, validCustomDomain } from '../../domain/site-domain';
import { suggestSiteSlug } from '../../domain/site-slug';
import type { SiteTemplate } from '../../domain/site-template.entity';
import { Site } from '../../domain/site.entity';
import { DOMAIN_CHECK_PATH, publishDomainFolder, removeDomainFolder } from '../domain-pages';
import { SITE_ASSET_REPOSITORY, type SiteAssetRepository } from '../ports/site-asset.repository';
import { SITE_DOMAIN_CHECKER, type SiteDomainChecker } from '../ports/site-domain-checker';
import { SITE_HOSTING, type SiteHosting } from '../ports/site-hosting';
import { SITE_ACCOUNT, type SiteAccount } from '../ports/site-sources';
import {
  SITE_TEMPLATE_REPOSITORY,
  type SiteTemplateRepository,
} from '../ports/site-template.repository';
import { SITE_REPOSITORY, type SiteRepository } from '../ports/site.repository';
import { LandingRelocator } from '../landing-location';
import { SiteComposer } from '../site-composer';
import { choosableTemplate } from '../template-choice';
import { CheckSiteDomainJob, ProcessSiteJob } from '../sites-jobs';

async function loadCurrent(sites: SiteRepository): Promise<Site> {
  const site = await sites.findCurrent();
  if (!site) throw new SiteNotFoundError('SITE_NOT_FOUND');
  return site;
}

export interface SiteDetails {
  site: Site;
  template: SiteTemplate | null;
}

export interface SiteOverview {
  details: SiteDetails | null;
  /** Quem está logado pode definir o domínio próprio (conta-mãe ou plataforma). */
  canManageDomain: boolean;
}

@Injectable()
export class GetSiteUseCase {
  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_ACCOUNT) private readonly account: SiteAccount,
  ) {}

  async execute(): Promise<SiteOverview> {
    const site = await this.sites.findCurrent();
    const canManageDomain =
      (await this.account.current()).isRoot || (await this.account.actingFromParentAccount());
    if (!site) return { details: null, canManageDomain };
    return {
      details: { site, template: await this.templates.findForSite(site.templateId) },
      canManageDomain,
    };
  }
}

/**
 * O site da conta, a partir de um modelo: conteúdo inicial com o nome da
 * conta e endereço sugerido pelo slug dela (com sufixo se já houver outro).
 */
@Injectable()
export class CreateSiteUseCase {
  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_ACCOUNT) private readonly account: SiteAccount,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: { templateId: string }): Promise<SiteDetails> {
    if (await this.sites.findCurrent()) throw new SiteConflictError('SITE_ALREADY_EXISTS');
    const template = await choosableTemplate(this.templates, input.templateId, null);
    const account = await this.account.current();

    const base = suggestSiteSlug(account.slug);
    let slug = base;
    for (let n = 2; await this.sites.isSlugTaken(slug, null); n++) slug = `${base}-${n}`;

    const site = Site.create(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      templateId: template.id,
      slug,
      content: defaultSiteContent(account.name),
    });
    await this.sites.save(site);
    return { site, template };
  }
}

/**
 * Edita o rascunho (o que está no ar só muda ao publicar). O domínio próprio
 * (`customDomain`, null = tira) só muda por quem gerencia a conta — acesso
 * da conta-mãe — ou na conta da plataforma (ADR 0011).
 */
@Injectable()
export class UpdateSiteUseCase {
  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_ASSET_REPOSITORY) private readonly assets: SiteAssetRepository,
    @Inject(SITE_ACCOUNT) private readonly account: SiteAccount,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    private readonly landings: LandingRelocator,
  ) {}

  async execute(changes: {
    content?: SiteContent;
    slug?: string;
    templateId?: string;
    customDomain?: string | null;
  }): Promise<SiteDetails> {
    const { customDomain, ...edits } = changes;
    const site = await loadCurrent(this.sites);
    const domainChanged =
      customDomain !== undefined && (await this.changeDomain(site, customDomain));
    if (changes.templateId && changes.templateId !== site.templateId) {
      await choosableTemplate(this.templates, changes.templateId, site.templateId);
    }
    if (changes.content) {
      const wanted = referencedAssetIds(changes.content);
      const found = await this.assets.findByIds(wanted);
      if (found.length !== wanted.length) throw new InvalidSiteError('SITE_UNKNOWN_ASSET');
    }
    site.edit(edits);
    if (changes.slug !== undefined && (await this.sites.isSlugTaken(site.slug, site.id))) {
      throw new SiteConflictError('SITE_SLUG_TAKEN');
    }
    await this.sites.save(site);
    if (domainChanged) await this.sites.saveDomainStatus(site);
    // Site fora do ar mudou de endereço: as landing pages no ar vão junto.
    if (changes.slug !== undefined && !site.isLive) await this.landings.relocate(site);
    return { site, template: await this.templates.findForSite(site.templateId) };
  }

  private async changeDomain(site: Site, raw: string | null): Promise<boolean> {
    const domain = raw?.trim() ? validCustomDomain(raw, this.hosting.sitesDomain) : null;
    if (domain === site.customDomain) return false;
    const account = await this.account.current();
    if (!account.isRoot && !(await this.account.actingFromParentAccount())) {
      throw new SiteDomainManagedAboveError();
    }
    if (domain && (await this.sites.isDomainTaken(domainVariants(domain), site.id))) {
      throw new SiteConflictError('SITE_DOMAIN_TAKEN');
    }
    return site.setCustomDomain(domain);
  }
}

/**
 * O HTML do site como ficaria: com o conteúdo em edição (sem gravar) e/ou
 * outro modelo. Sem site ainda, mostra um modelo com o conteúdo inicial da
 * conta (a escolha do modelo).
 */
@Injectable()
export class PreviewSiteUseCase {
  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_ACCOUNT) private readonly account: SiteAccount,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    private readonly composer: SiteComposer,
  ) {}

  async execute(input: { content?: SiteContent; templateId?: string }): Promise<string> {
    const site = await this.sites.findCurrent();
    const templateId = input.templateId ?? site?.templateId;
    if (!templateId) throw new SiteNotFoundError('SITE_TEMPLATE_NOT_FOUND');
    const template = await choosableTemplate(this.templates, templateId, site?.templateId ?? null);

    const content = input.content
      ? normalizeSiteContent(input.content)
      : (site?.content ?? defaultSiteContent((await this.account.current()).name));
    const url = site && this.hosting.enabled ? publicUrl(this.hosting, site) : null;
    return this.composer.render(template.html, content, url, { preview: true });
  }
}

/** Pede ao worker que publique (ou tire do ar) o site. */
@Injectable()
export class RequestSitePublicationUseCase {
  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async execute(action: 'publish' | 'unpublish'): Promise<SiteDetails> {
    if (!this.hosting.enabled) throw new InvalidSiteError('SITES_NOT_CONFIGURED');
    const site = await loadCurrent(this.sites);
    const template = await this.templates.findForSite(site.templateId);
    // Fora do ar e nada pendente: tirar do ar não tem o que fazer.
    if (action === 'unpublish' && !site.isLive && !site.pendingAction) {
      return { site, template };
    }
    if (action === 'publish') site.requestPublish();
    else site.requestUnpublish();
    await this.sites.savePublication(site);
    await this.jobs.add(ProcessSiteJob, { siteId: site.id });
    return { site, template };
  }
}

/** Endereço principal do site: o domínio próprio, se houver; senão o nosso. */
function publicUrl(hosting: SiteHosting, site: Site): string {
  return site.customDomain ? hosting.domainUrl(site.customDomain) : hosting.siteUrl(site.slug);
}

/**
 * Worker: faz o que estiver pendente no site. Publicar grava o HTML em
 * `<slug>/index.html` e, com domínio próprio, na pasta do domínio (mais a
 * verificação e o redirecionamento do domínio sem www); endereço ou domínio
 * trocados saem do ar. Erro do modelo vira falha na hora (repetir não
 * resolve); erro do armazenamento sobe para a fila tentar de novo.
 */
@Injectable()
export class ProcessSiteUseCase {
  private readonly logger = new Logger(ProcessSiteUseCase.name);

  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
    private readonly composer: SiteComposer,
    private readonly landings: LandingRelocator,
  ) {}

  async execute(siteId: string): Promise<void> {
    // Antes de ler: edição feita durante a publicação conta como "não publicada".
    const startedAt = new Date();
    const site = await this.sites.findById(siteId);
    if (!site?.pendingAction) return;

    if (site.pendingAction === 'unpublish') {
      if (site.publishedSlug) await this.hosting.removePage(site.publishedSlug);
      if (site.publishedDomain) await removeDomainFolder(this.hosting, site.publishedDomain);
      site.markUnpublished();
      await this.sites.savePublication(site);
      await this.landings.relocate(site, { everyLive: true });
      this.logger.log(`Site ${site.slug} fora do ar`);
      return;
    }

    const template = await this.templates.findForSite(site.templateId);
    if (!template) {
      site.markFailed('SITE_TEMPLATE_NOT_FOUND');
      await this.sites.savePublication(site);
      return;
    }
    let html: string;
    try {
      html = await this.composer.render(template.html, site.content, publicUrl(this.hosting, site));
    } catch (error) {
      if (!(error instanceof InvalidSiteError)) throw error;
      site.markFailed(error.code);
      await this.sites.savePublication(site);
      return;
    }
    await this.hosting.publishPage(site.slug, html);
    if (site.customDomain) {
      await publishDomainFolder(this.hosting, site.customDomain, html, site.id);
    }
    if (site.publishedSlug && site.publishedSlug !== site.slug) {
      await this.hosting.removePage(site.publishedSlug);
    }
    if (site.publishedDomain && site.publishedDomain !== site.customDomain) {
      await removeDomainFolder(this.hosting, site.publishedDomain);
    }
    const wasLive = site.isLive;
    site.markPublished(site.slug, site.customDomain, startedAt);
    await this.sites.savePublication(site);
    await this.landings.relocate(site, { everyLive: !wasLive });
    this.logger.log(`Site ${site.slug} publicado`);
    // Pouco depois (dá tempo de o arquivo de verificação chegar à borda); a
    // tela mostra "verificando…" até lá.
    if (site.customDomain) {
      site.markDomainChecking();
      await this.sites.saveDomainStatus(site);
      await this.jobs.add(CheckSiteDomainJob, { siteId: site.id }, { delayMs: 3_000 });
    }
  }
}

/** Pede a verificação do domínio próprio (a tela mostra "verificando…"). */
@Injectable()
export class RequestSiteDomainCheckUseCase {
  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async execute(): Promise<SiteDetails> {
    const site = await loadCurrent(this.sites);
    const template = await this.templates.findForSite(site.templateId);
    if (!site.customDomain) return { site, template };
    site.markDomainChecking();
    await this.sites.saveDomainStatus(site);
    await this.jobs.add(CheckSiteDomainJob, { siteId: site.id });
    return { site, template };
  }
}

/**
 * Worker: o domínio já chega no site? Busca, pelo próprio domínio, o arquivo
 * de verificação publicado. Sem publicar no domínio ainda, fica "pendente".
 */
@Injectable()
export class CheckSiteDomainUseCase {
  private readonly logger = new Logger(CheckSiteDomainUseCase.name);

  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_DOMAIN_CHECKER) private readonly checker: SiteDomainChecker,
  ) {}

  async execute(siteId: string): Promise<void> {
    const site = await this.sites.findById(siteId);
    if (!site?.customDomain) return;
    if (site.publishedDomain !== site.customDomain) {
      site.markDomainPending();
    } else {
      const ok = await this.checker.reaches(site.customDomain, DOMAIN_CHECK_PATH, site.id);
      site.markDomainChecked(ok, new Date());
      this.logger.log(`Domínio ${site.customDomain}: ${ok ? 'conectado' : 'não respondeu'}`);
    }
    await this.sites.saveDomainStatus(site);
  }
}

/** As tentativas da fila acabaram: o site sai de "publicando" com o motivo. */
@Injectable()
export class GiveUpSiteUseCase {
  constructor(@Inject(SITE_REPOSITORY) private readonly sites: SiteRepository) {}

  async execute(siteId: string): Promise<void> {
    const site = await this.sites.findById(siteId);
    if (!site?.pendingAction) return;
    site.markFailed('SITE_HOSTING_UNAVAILABLE');
    await this.sites.savePublication(site);
  }
}
