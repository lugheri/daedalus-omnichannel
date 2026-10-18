import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { InvalidSiteError } from '../../domain/errors/invalid-site.error';
import { SiteConflictError } from '../../domain/errors/site-conflict.error';
import { SiteNotFoundError } from '../../domain/errors/site-not-found.error';
import { SiteTemplatesRootOnlyError } from '../../domain/errors/site-templates-root-only.error';
import {
  SiteTemplate,
  type SiteTemplateDetails,
  type SiteTemplateKind,
} from '../../domain/site-template.entity';
import { buildLandingView } from '../landing-view';
import { SITE_RENDERER, type SiteRenderer } from '../ports/site-renderer';
import { SITE_ACCOUNT, type SiteAccount } from '../ports/site-sources';
import {
  SITE_TEMPLATE_REPOSITORY,
  type SiteTemplateRepository,
} from '../ports/site-template.repository';
import { sampleLandingInput, sampleSiteInput } from '../sample-site';
import { buildSiteView } from '../site-view';
import { STARTER_LANDING_TEMPLATE_HTML } from '../starter-landing-template';
import { STARTER_TEMPLATE_HTML } from '../starter-template';

/** Modelos são mantidos só na conta da plataforma (por enquanto). */
@Injectable()
export class TemplateKeeper {
  constructor(@Inject(SITE_ACCOUNT) private readonly account: SiteAccount) {}

  async assert(): Promise<void> {
    if (!(await this.account.current()).isRoot) throw new SiteTemplatesRootOnlyError();
  }
}

function assertReadable(renderer: SiteRenderer, html: string): void {
  const problem = renderer.check(html);
  if (problem) throw new InvalidSiteError('SITE_TEMPLATE_INVALID_HTML', problem);
}

async function loadOwned(templates: SiteTemplateRepository, id: string): Promise<SiteTemplate> {
  const template = await templates.findOwned(id);
  if (!template) throw new SiteNotFoundError('SITE_TEMPLATE_NOT_FOUND');
  return template;
}

export interface TemplateWithUsage {
  template: SiteTemplate;
  sites: number;
}

@Injectable()
export class ListSiteTemplatesUseCase {
  constructor(
    private readonly keeper: TemplateKeeper,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
  ) {}

  async execute(): Promise<TemplateWithUsage[]> {
    await this.keeper.assert();
    const templates = await this.templates.listOwned();
    return Promise.all(
      templates.map(async (template) => ({
        template,
        sites: await this.templates.countSitesUsing(template.id),
      })),
    );
  }
}

@Injectable()
export class GetSiteTemplateUseCase {
  constructor(
    private readonly keeper: TemplateKeeper,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
  ) {}

  async execute(id: string): Promise<TemplateWithUsage> {
    await this.keeper.assert();
    const template = await loadOwned(this.templates, id);
    return { template, sites: await this.templates.countSitesUsing(id) };
  }
}

/** Modelo novo nasce como rascunho, com o HTML do modelo inicial do tipo (se não vier outro). */
@Injectable()
export class CreateSiteTemplateUseCase {
  constructor(
    private readonly keeper: TemplateKeeper,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_RENDERER) private readonly renderer: SiteRenderer,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: Omit<SiteTemplateDetails, 'html'> & {
      html?: string | null;
      kind?: SiteTemplateKind;
    },
  ): Promise<SiteTemplate> {
    await this.keeper.assert();
    const kind = input.kind ?? 'site';
    const html =
      input.html ?? (kind === 'landing' ? STARTER_LANDING_TEMPLATE_HTML : STARTER_TEMPLATE_HTML);
    assertReadable(this.renderer, html);
    const template = SiteTemplate.create(this.ids.generate(), {
      ...input,
      kind,
      html,
      tenantId: this.tenant.tenantId,
    });
    await this.templates.save(template);
    return template;
  }
}

/**
 * Sites que já usam o modelo pegam a mudança na próxima publicação. Deixar de
 * ficar disponível só tira o modelo da escolha: quem usa continua usando.
 */
@Injectable()
export class UpdateSiteTemplateUseCase {
  constructor(
    private readonly keeper: TemplateKeeper,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
    @Inject(SITE_RENDERER) private readonly renderer: SiteRenderer,
  ) {}

  async execute(
    id: string,
    changes: Partial<SiteTemplateDetails> & { available?: boolean },
  ): Promise<SiteTemplate> {
    await this.keeper.assert();
    const template = await loadOwned(this.templates, id);
    if (changes.html !== undefined) assertReadable(this.renderer, changes.html);
    template.update(changes);
    await this.templates.save(template);
    return template;
  }
}

/** Só modelo que nenhum site usa (usado: deixe indisponível). */
@Injectable()
export class DeleteSiteTemplateUseCase {
  constructor(
    private readonly keeper: TemplateKeeper,
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
  ) {}

  async execute(id: string): Promise<void> {
    await this.keeper.assert();
    const template = await loadOwned(this.templates, id);
    if ((await this.templates.countSitesUsing(id)) > 0) {
      throw new SiteConflictError('SITE_TEMPLATE_IN_USE');
    }
    await this.templates.delete(template);
  }
}

/** O HTML em edição com o site (ou a landing) de exemplo, todas as seções preenchidas. */
@Injectable()
export class PreviewSiteTemplateUseCase {
  constructor(
    private readonly keeper: TemplateKeeper,
    @Inject(SITE_RENDERER) private readonly renderer: SiteRenderer,
  ) {}

  async execute(html: string, kind: SiteTemplateKind = 'site'): Promise<string> {
    await this.keeper.assert();
    const view =
      kind === 'landing'
        ? buildLandingView(sampleLandingInput())
        : buildSiteView(sampleSiteInput());
    return this.renderer.render(html, view);
  }
}

/** Os modelos que qualquer conta pode escolher (para o site ou para landing pages). */
@Injectable()
export class ListAvailableTemplatesUseCase {
  constructor(
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
  ) {}

  execute(kind: SiteTemplateKind = 'site'): Promise<SiteTemplate[]> {
    return this.templates.listAvailable(kind);
  }
}
