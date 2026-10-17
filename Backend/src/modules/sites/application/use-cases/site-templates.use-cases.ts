import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { InvalidSiteError } from '../../domain/errors/invalid-site.error';
import { SiteConflictError } from '../../domain/errors/site-conflict.error';
import { SiteNotFoundError } from '../../domain/errors/site-not-found.error';
import { SiteTemplatesRootOnlyError } from '../../domain/errors/site-templates-root-only.error';
import { SiteTemplate, type SiteTemplateDetails } from '../../domain/site-template.entity';
import { SITE_RENDERER, type SiteRenderer } from '../ports/site-renderer';
import { SITE_ACCOUNT, type SiteAccount } from '../ports/site-sources';
import {
  SITE_TEMPLATE_REPOSITORY,
  type SiteTemplateRepository,
} from '../ports/site-template.repository';
import { sampleSiteInput } from '../sample-site';
import { buildSiteView } from '../site-view';
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

/** Modelo novo nasce como rascunho, com o HTML do modelo inicial (se não vier outro). */
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
    input: Omit<SiteTemplateDetails, 'html'> & { html?: string | null },
  ): Promise<SiteTemplate> {
    await this.keeper.assert();
    const html = input.html ?? STARTER_TEMPLATE_HTML;
    assertReadable(this.renderer, html);
    const template = SiteTemplate.create(this.ids.generate(), {
      ...input,
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

/** O HTML em edição com o site de exemplo (todas as seções preenchidas). */
@Injectable()
export class PreviewSiteTemplateUseCase {
  constructor(
    private readonly keeper: TemplateKeeper,
    @Inject(SITE_RENDERER) private readonly renderer: SiteRenderer,
  ) {}

  async execute(html: string): Promise<string> {
    await this.keeper.assert();
    return this.renderer.render(html, buildSiteView(sampleSiteInput()));
  }
}

/** Os modelos que qualquer conta pode escolher para o próprio site. */
@Injectable()
export class ListAvailableTemplatesUseCase {
  constructor(
    @Inject(SITE_TEMPLATE_REPOSITORY) private readonly templates: SiteTemplateRepository,
  ) {}

  execute(): Promise<SiteTemplate[]> {
    return this.templates.listAvailable();
  }
}
