import { Inject, Injectable, Logger } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { JOB_QUEUE, type JobQueue } from '../../../../shared/application/job-queue';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import {
  compareVariants,
  conversionRate,
  type Comparison,
  type VariantNumbers,
} from '../../domain/ab-test';
import { InvalidSiteError } from '../../domain/errors/invalid-site.error';
import { SiteConflictError } from '../../domain/errors/site-conflict.error';
import { SiteNotFoundError } from '../../domain/errors/site-not-found.error';
import {
  defaultLandingContent,
  landingAssetIds,
  normalizeLandingContent,
  type LandingContent,
} from '../../domain/landing-content';
import { LandingPage, type LandingVariant } from '../../domain/landing-page.entity';
import type { SiteTemplate } from '../../domain/site-template.entity';
import { LandingComposer } from '../landing-composer';
import { retiredVariantPage, splitPage } from '../landing-pages';
import {
  LANDING_PAGE_REPOSITORY,
  type LandingPageRepository,
} from '../ports/landing-page.repository';
import {
  LANDING_STATS_REPOSITORY,
  type LandingStatsRepository,
} from '../ports/landing-stats.repository';
import { SITE_ASSET_REPOSITORY, type SiteAssetRepository } from '../ports/site-asset.repository';
import { SITE_HOSTING, type SiteHosting } from '../ports/site-hosting';
import { SITE_SOURCES, type SiteSources } from '../ports/site-sources';
import {
  SITE_TEMPLATE_REPOSITORY,
  type SiteTemplateRepository,
} from '../ports/site-template.repository';
import { SITE_REPOSITORY, type SiteRepository } from '../ports/site.repository';
import { landingLocation, requestLandingPublication } from '../landing-location';
import { choosableTemplate } from '../template-choice';

/** Por conta, até virem os planos (passo 9). */
export const MAX_LANDING_PAGES = 30;

async function loadPage(pages: LandingPageRepository, id: string): Promise<LandingPage> {
  const page = await pages.findById(id);
  if (!page) throw new SiteNotFoundError('LANDING_NOT_FOUND');
  return page;
}

export interface LandingDetails {
  page: LandingPage;
  /** Endereço da página (com o site no ar ou não); null sem publicação configurada. */
  url: string | null;
  /** Nome do modelo de cada variante. */
  templates: Map<string, SiteTemplate>;
}

async function details(
  page: LandingPage,
  sites: SiteRepository,
  templates: SiteTemplateRepository,
  hosting: SiteHosting,
): Promise<LandingDetails> {
  const site = await sites.findCurrent();
  const found = await Promise.all(
    [...new Set(page.variants.map((v) => v.templateId))].map((id) => templates.findForSite(id)),
  );
  return {
    page,
    url: site ? landingLocation(hosting, site).pageUrl(page.path) : null,
    templates: new Map(found.filter((t): t is SiteTemplate => !!t).map((t) => [t.id, t])),
  };
}

function sum(numbers: (VariantNumbers | undefined)[]): VariantNumbers {
  return numbers.reduce<VariantNumbers>(
    (acc, n) => ({
      views: acc.views + (n?.views ?? 0),
      conversions: acc.conversions + (n?.conversions ?? 0),
    }),
    { views: 0, conversions: 0 },
  );
}

@Injectable()
export class ListLandingPagesUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(LANDING_STATS_REPOSITORY) private readonly stats: LandingStatsRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
  ) {}

  async execute(): Promise<{
    hasSite: boolean;
    pages: { page: LandingPage; url: string | null; numbers: VariantNumbers }[];
  }> {
    const [site, pages] = await Promise.all([this.sites.findCurrent(), this.pages.list()]);
    const totals = await this.stats.totals(pages.flatMap((p) => p.variants.map((v) => v.id)));
    const where = site ? landingLocation(this.hosting, site) : null;
    return {
      hasSite: site !== null,
      pages: pages.map((page) => ({
        page,
        url: where?.pageUrl(page.path) ?? null,
        numbers: sum(page.variants.map((v) => totals.get(v.id))),
      })),
    };
  }
}

@Injectable()
export class GetLandingPageUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
  ) {}

  async execute(id: string): Promise<LandingDetails> {
    return details(await loadPage(this.pages, id), this.sites, this.templates, this.hosting);
  }
}

/** Formulário da landing: um ativo da conta (o envio dele é a conversão). */
async function assertForm(sources: SiteSources, formId: string | null): Promise<void> {
  if (formId && !(await sources.form(formId))) throw new InvalidSiteError('LANDING_UNKNOWN_FORM');
}

/**
 * Landing page nova, com a variante A no modelo escolhido e o conteúdo
 * inicial. Precisa do site da conta (mora no endereço dele).
 */
@Injectable()
export class CreateLandingPageUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_SOURCES) private readonly sources: SiteSources,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    name: string;
    path: string;
    templateId: string;
    formId: string | null;
  }): Promise<LandingDetails> {
    const site = await this.sites.findCurrent();
    if (!site) throw new InvalidSiteError('LANDING_SITE_REQUIRED');
    if ((await this.pages.count()) >= MAX_LANDING_PAGES) {
      throw new SiteConflictError('LANDING_LIMIT_REACHED');
    }
    const template = await choosableTemplate(this.templates, input.templateId, null, 'landing');
    await assertForm(this.sources, input.formId);
    const page = LandingPage.create(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      name: input.name,
      path: input.path,
      formId: input.formId,
      firstVariant: {
        id: this.ids.generate(),
        templateId: template.id,
        content: defaultLandingContent(site.content.business.name),
      },
    });
    if (await this.pages.isPathTaken(page.path, null)) {
      throw new SiteConflictError('LANDING_PATH_TAKEN');
    }
    await this.pages.save(page);
    return details(page, this.sites, this.templates, this.hosting);
  }
}

/** Nome, caminho (vale ao publicar de novo) e formulário. */
@Injectable()
export class UpdateLandingPageUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_SOURCES) private readonly sources: SiteSources,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
  ) {}

  async execute(
    id: string,
    changes: { name?: string; path?: string; formId?: string | null },
  ): Promise<LandingDetails> {
    const page = await loadPage(this.pages, id);
    if (changes.formId !== undefined && changes.formId !== page.formId) {
      await assertForm(this.sources, changes.formId);
    }
    page.edit(changes);
    if (changes.path !== undefined && (await this.pages.isPathTaken(page.path, page.id))) {
      throw new SiteConflictError('LANDING_PATH_TAKEN');
    }
    await this.pages.save(page);
    return details(page, this.sites, this.templates, this.hosting);
  }
}

/** Só fora do ar (tire do ar antes): o que foi publicado precisa sair do bucket. */
@Injectable()
export class DeleteLandingPageUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(LANDING_STATS_REPOSITORY) private readonly stats: LandingStatsRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const page = await loadPage(this.pages, id);
    if (page.isLive || page.pendingAction) throw new SiteConflictError('LANDING_IS_LIVE');
    await this.stats.clear(page.variants.map((v) => v.id));
    await this.pages.delete(page);
  }
}

/** Variante nova, cópia de outra (padrão: a primeira) — é como se começa um teste. */
@Injectable()
export class AddLandingVariantUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(
    id: string,
    input: { copyFrom: string | null },
  ): Promise<{ details: LandingDetails; variant: LandingVariant }> {
    const page = await loadPage(this.pages, id);
    const source = input.copyFrom ? page.variant(input.copyFrom) : page.variants[0];
    const variant = page.addVariant(this.ids.generate(), source);
    await this.pages.save(page);
    return { details: await details(page, this.sites, this.templates, this.hosting), variant };
  }
}

@Injectable()
export class UpdateLandingVariantUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_ASSET_REPOSITORY) private readonly assets: SiteAssetRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
  ) {}

  async execute(
    id: string,
    variantId: string,
    changes: { name?: string; templateId?: string; content?: LandingContent; weight?: number },
  ): Promise<LandingDetails> {
    const page = await loadPage(this.pages, id);
    const variant = page.variant(variantId);
    if (changes.templateId && changes.templateId !== variant.templateId) {
      await choosableTemplate(this.templates, changes.templateId, variant.templateId, 'landing');
    }
    if (changes.content) {
      const wanted = landingAssetIds(changes.content);
      if ((await this.assets.findByIds(wanted)).length !== wanted.length) {
        throw new InvalidSiteError('SITE_UNKNOWN_ASSET');
      }
    }
    page.updateVariant(variantId, changes);
    await this.pages.save(page);
    return details(page, this.sites, this.templates, this.hosting);
  }
}

/** Tira a variante (e os números dela). A última não sai. */
@Injectable()
export class RemoveLandingVariantUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(LANDING_STATS_REPOSITORY) private readonly stats: LandingStatsRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
  ) {}

  async execute(id: string, variantId: string): Promise<LandingDetails> {
    const page = await loadPage(this.pages, id);
    page.removeVariant(variantId);
    await this.pages.save(page);
    await this.stats.clear([variantId]);
    return details(page, this.sites, this.templates, this.hosting);
  }
}

/**
 * Fim do teste: só o vencedor fica com o tráfego. No ar, já publica (o
 * endereço passa a mostrar só o vencedor); os números ficam guardados.
 */
@Injectable()
export class ChooseLandingWinnerUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async execute(id: string, variantId: string): Promise<LandingDetails> {
    const page = await loadPage(this.pages, id);
    page.chooseWinner(variantId);
    await this.pages.save(page);
    if (page.isLive && this.hosting.enabled) {
      await requestLandingPublication(page, 'publish', this.pages, this.jobs);
    }
    return details(page, this.sites, this.templates, this.hosting);
  }
}

/** O HTML de uma variante como ficaria (conteúdo/modelo em edição, sem gravar). */
@Injectable()
export class PreviewLandingUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    private readonly composer: LandingComposer,
  ) {}

  async execute(
    id: string,
    input: { variantId: string; templateId?: string; content?: LandingContent },
  ): Promise<string> {
    const page = await loadPage(this.pages, id);
    const variant = page.variant(input.variantId);
    const site = await this.sites.findCurrent();
    if (!site) throw new InvalidSiteError('LANDING_SITE_REQUIRED');
    const template = await choosableTemplate(
      this.templates,
      input.templateId ?? variant.templateId,
      variant.templateId,
      'landing',
    );
    const where = landingLocation(this.hosting, site);
    return this.composer.render(
      template.html,
      {
        site: site.content,
        landing: input.content ? normalizeLandingContent(input.content) : variant.content,
        variantId: variant.id,
        variantCode: variant.code,
        pageUrl: where.pageUrl(page.path),
        homeUrl: where.homeUrl,
        formId: page.formId,
      },
      { preview: true },
    );
  }
}

@Injectable()
export class RequestLandingPublicationUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async execute(id: string, action: 'publish' | 'unpublish'): Promise<LandingDetails> {
    if (!this.hosting.enabled) throw new InvalidSiteError('SITES_NOT_CONFIGURED');
    const page = await loadPage(this.pages, id);
    if (action === 'publish' && !(await this.sites.findCurrent())) {
      throw new InvalidSiteError('LANDING_SITE_REQUIRED');
    }
    if (!(action === 'unpublish' && !page.isLive && !page.pendingAction)) {
      await requestLandingPublication(page, action, this.pages, this.jobs);
    }
    return details(page, this.sites, this.templates, this.hosting);
  }
}

/**
 * Worker: faz o que a landing page tem pendente. Publicar grava, em cada
 * pasta do site, `<path>/index.html` — a variante, ou o sorteio com as
 * variantes em `<path>/<letra>/` durante um teste. Variante que saiu do teste
 * vira redirecionamento; caminho ou pasta antigos saem do ar. Erro do modelo
 * vira falha na hora; erro do armazenamento sobe para a fila tentar de novo.
 */
@Injectable()
export class ProcessLandingUseCase {
  private readonly logger = new Logger(ProcessLandingUseCase.name);

  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    private readonly composer: LandingComposer,
  ) {}

  async execute(pageId: string): Promise<void> {
    // Antes de ler: edição feita durante a publicação conta como "não publicada".
    const startedAt = new Date();
    const page = await this.pages.findById(pageId);
    if (!page?.pendingAction) return;

    if (page.pendingAction === 'unpublish') {
      await this.remove(page.publishedFolders, page.publishedPath, page.publishedCodes);
      page.markUnpublished();
      await this.pages.savePublication(page);
      this.logger.log(`Landing ${page.path} fora do ar`);
      return;
    }

    const site = await this.sites.findCurrent();
    if (!site) return this.fail(page, 'LANDING_SITE_REQUIRED');
    const active = page.activeVariants;
    if (active.length === 0) return this.fail(page, 'LANDING_NO_ACTIVE_VARIANT');
    const where = landingLocation(this.hosting, site);

    const rendered: { code: string; html: string }[] = [];
    try {
      for (const variant of active) {
        const template = await this.templates.findForSite(variant.templateId);
        if (!template) return this.fail(page, 'SITE_TEMPLATE_NOT_FOUND');
        const html = await this.composer.render(template.html, {
          site: site.content,
          landing: variant.content,
          variantId: variant.id,
          variantCode: variant.code,
          pageUrl: where.pageUrl(page.path),
          homeUrl: where.homeUrl,
          formId: page.formId,
        });
        rendered.push({ code: variant.code, html });
      }
    } catch (error) {
      if (!(error instanceof InvalidSiteError)) throw error;
      return this.fail(page, error.code);
    }

    const testing = rendered.length > 1;
    const first = active[0].content;
    const index = testing
      ? splitPage({
          pageId: page.id,
          path: page.path,
          title: first.seo.title ?? first.hero.title ?? site.content.business.name,
          variants: active.map((v) => ({ code: v.code, weight: v.weight })),
        })
      : rendered[0].html;
    const codes = testing ? rendered.map((r) => r.code) : [];
    const samePath = page.publishedPath === page.path;
    // Letras que estavam no ar neste caminho e saíram: viram redirecionamento.
    const retired = samePath ? page.publishedCodes.filter((c) => !codes.includes(c)) : [];

    for (const folder of where.folders) {
      const dir = `${folder}/${page.path}`;
      await this.hosting.publishPage(dir, index);
      for (const r of testing ? rendered : []) {
        await this.hosting.publishPage(`${dir}/${r.code}`, r.html);
      }
      if (samePath && page.publishedFolders.includes(folder)) {
        for (const code of retired) {
          await this.hosting.publishPage(`${dir}/${code}`, retiredVariantPage(page.path));
        }
      }
    }
    // Caminho trocado ou pasta que deixou de ser do site: sai do ar.
    const stale = page.publishedFolders.filter(
      (folder) => !samePath || !where.folders.includes(folder),
    );
    await this.remove(stale, page.publishedPath, page.publishedCodes);

    page.markPublished({
      folders: where.folders,
      path: page.path,
      codes: [...codes, ...retired],
      startedAt,
    });
    await this.pages.savePublication(page);
    this.logger.log(`Landing ${page.path} publicada (${rendered.length} variante(s))`);
  }

  private async remove(folders: string[], path: string | null, codes: string[]): Promise<void> {
    if (!path) return;
    for (const folder of folders) {
      await this.hosting.removePage(`${folder}/${path}`);
      for (const code of codes) await this.hosting.removePage(`${folder}/${path}/${code}`);
    }
  }

  private async fail(page: LandingPage, code: string): Promise<void> {
    page.markFailed(code);
    await this.pages.savePublication(page);
  }
}

/** As tentativas da fila acabaram: a landing sai de "publicando" com o motivo. */
@Injectable()
export class GiveUpLandingUseCase {
  constructor(@Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository) {}

  async execute(pageId: string): Promise<void> {
    const page = await this.pages.findById(pageId);
    if (!page?.pendingAction) return;
    page.markFailed('SITE_HOSTING_UNAVAILABLE');
    await this.pages.savePublication(page);
  }
}

export interface VariantStats {
  variant: LandingVariant;
  numbers: VariantNumbers;
  rate: number | null;
  /** Comparação com a de controle (null na própria). */
  comparison: Comparison | null;
}

/** Números do teste: visitas, conversões e taxa por variante, comparadas com a de controle (A). */
@Injectable()
export class LandingStatsUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(LANDING_STATS_REPOSITORY) private readonly stats: LandingStatsRepository,
  ) {}

  async execute(id: string): Promise<{ page: LandingPage; variants: VariantStats[] }> {
    const page = await loadPage(this.pages, id);
    const totals = await this.stats.totals(page.variants.map((v) => v.id));
    const numbersOf = (v: LandingVariant) => totals.get(v.id) ?? { views: 0, conversions: 0 };
    const control = page.variants[0];
    return {
      page,
      variants: page.variants.map((variant) => ({
        variant,
        numbers: numbersOf(variant),
        rate: conversionRate(numbersOf(variant)),
        comparison:
          variant.id === control.id
            ? null
            : compareVariants(numbersOf(control), numbersOf(variant)),
      })),
    };
  }
}

/** Recomeçar a contagem (mudou o conteúdo de uma variante no meio do teste, por exemplo). */
@Injectable()
export class ResetLandingStatsUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(LANDING_STATS_REPOSITORY) private readonly stats: LandingStatsRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const page = await loadPage(this.pages, id);
    await this.stats.clear(page.variants.map((v) => v.id));
  }
}

/**
 * Rota pública: a página publicada avisou uma visita. A variante diz a conta;
 * página fora do ar ou variante desconhecida não contam (e não dão erro: o
 * aviso é "atire e esqueça").
 */
@Injectable()
export class RecordLandingViewUseCase {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(LANDING_STATS_REPOSITORY) private readonly stats: LandingStatsRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(variantId: string, at = new Date()): Promise<void> {
    const owner = await this.pages.findVariantOwnerAsSystem(variantId);
    if (!owner?.live) return;
    this.tenant.enter(owner.tenantId);
    await this.stats.recordView(variantId, at.toISOString().slice(0, 10));
  }
}
