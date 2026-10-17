import {
  FakeTenantContext,
  InMemoryFileStorage,
  RecordingJobQueue,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { InvalidSiteError } from '../../domain/errors/invalid-site.error';
import { SiteConflictError } from '../../domain/errors/site-conflict.error';
import { SiteDomainManagedAboveError } from '../../domain/errors/site-domain-managed-above.error';
import { SiteNotFoundError } from '../../domain/errors/site-not-found.error';
import { SiteTemplatesRootOnlyError } from '../../domain/errors/site-templates-root-only.error';
import type { SiteContent } from '../../domain/site-content';
import {
  FakeSiteAccount,
  FakeSiteDomainChecker,
  FakeSiteSources,
  InMemorySiteAssetRepository,
  InMemorySiteHosting,
  InMemorySiteRepository,
  InMemorySiteTemplateRepository,
  JsonSiteRenderer,
} from '../../testing/fakes';
import { SiteComposer } from '../site-composer';
import { CheckSiteDomainJob, ProcessSiteJob } from '../sites-jobs';
import type { SiteView } from '../site-view';
import { STARTER_TEMPLATE_HTML } from '../starter-template';
import {
  DeleteSiteAssetUseCase,
  ListSiteAssetsUseCase,
  UploadSiteAssetUseCase,
} from './site-assets.use-cases';
import {
  CreateSiteTemplateUseCase,
  DeleteSiteTemplateUseCase,
  ListAvailableTemplatesUseCase,
  ListSiteTemplatesUseCase,
  PreviewSiteTemplateUseCase,
  TemplateKeeper,
  UpdateSiteTemplateUseCase,
} from './site-templates.use-cases';
import {
  CheckSiteDomainUseCase,
  CreateSiteUseCase,
  GetSiteUseCase,
  GiveUpSiteUseCase,
  PreviewSiteUseCase,
  ProcessSiteUseCase,
  RequestSiteDomainCheckUseCase,
  RequestSitePublicationUseCase,
  UpdateSiteUseCase,
} from './site.use-cases';

const PNG = Buffer.from('89504e47', 'hex');

describe('Sites', () => {
  let tenant: FakeTenantContext;
  let account: FakeSiteAccount;
  let sites: InMemorySiteRepository;
  let templates: InMemorySiteTemplateRepository;
  let assets: InMemorySiteAssetRepository;
  let hosting: InMemorySiteHosting;
  let sources: FakeSiteSources;
  let renderer: JsonSiteRenderer;
  let storage: InMemoryFileStorage;
  let jobs: RecordingJobQueue;
  let ids: SequentialIdGenerator;

  beforeEach(() => {
    tenant = new FakeTenantContext('platform');
    account = new FakeSiteAccount(tenant, {
      platform: { name: 'Daedalus', slug: 'daedalus', isRoot: true },
      'tenant-a': { name: 'Barbearia do Zé', slug: 'barbearia-do-ze', isRoot: false },
      'tenant-b': { name: 'Barbearia do Zé', slug: 'barbearia-do-ze-2', isRoot: false },
    });
    sites = new InMemorySiteRepository(tenant);
    templates = new InMemorySiteTemplateRepository(tenant, sites);
    assets = new InMemorySiteAssetRepository(tenant);
    hosting = new InMemorySiteHosting();
    sources = new FakeSiteSources();
    renderer = new JsonSiteRenderer();
    storage = new InMemoryFileStorage();
    jobs = new RecordingJobQueue();
    ids = new SequentialIdGenerator();
  });

  const keeper = () => new TemplateKeeper(account);
  const composer = () => new SiteComposer(sources, assets, hosting, renderer);
  const createTemplate = (input: { name?: string; html?: string } = {}) =>
    new CreateSiteTemplateUseCase(keeper(), templates, renderer, tenant, ids).execute({
      name: input.name ?? 'Barbearia clássica',
      niche: 'Barbearia',
      description: null,
      html: input.html ?? null,
    });
  const updateTemplate = () => new UpdateSiteTemplateUseCase(keeper(), templates, renderer);
  /** Modelo disponível, criado na conta da plataforma; volta para a conta `as`. */
  const availableTemplate = async (as = 'tenant-a', name?: string) => {
    tenant.switchTo('platform');
    const template = await createTemplate({ name });
    await updateTemplate().execute(template.id, { available: true });
    tenant.switchTo(as);
    return template;
  };
  const createSite = (templateId: string) =>
    new CreateSiteUseCase(sites, templates, account, tenant, ids).execute({ templateId });
  const updateSite = () => new UpdateSiteUseCase(sites, templates, assets, account, hosting);
  const request = () => new RequestSitePublicationUseCase(sites, templates, hosting, jobs);
  const process = () => new ProcessSiteUseCase(sites, templates, hosting, jobs, composer());
  const runJobs = async () => {
    const pending = jobs.of(ProcessSiteJob);
    jobs.jobs.splice(
      0,
      jobs.jobs.length,
      ...jobs.jobs.filter((j) => j.name !== ProcessSiteJob.name),
    );
    for (const { siteId } of pending) await process().execute(siteId);
  };
  const upload = (contentType = 'image/png', content = PNG) =>
    new UploadSiteAssetUseCase(assets, hosting, storage, tenant, ids).execute({
      content,
      contentType,
      fileName: 'foto.png',
    });
  const viewOf = (html: string) => JSON.parse(html) as SiteView;
  const withContent = async (change: (content: SiteContent) => void) => {
    const site = (await sites.findCurrent())!;
    const content = structuredClone(site.content);
    change(content);
    return updateSite().execute({ content });
  };

  describe('templates', () => {
    it('only the platform account keeps templates', async () => {
      tenant.switchTo('tenant-a');
      await expect(createTemplate()).rejects.toThrow(SiteTemplatesRootOnlyError);
      await expect(new ListSiteTemplatesUseCase(keeper(), templates).execute()).rejects.toThrow(
        SiteTemplatesRootOnlyError,
      );
    });

    it('a new template is a draft with the starter HTML; the list shows how many sites use it', async () => {
      const template = await createTemplate();
      expect(template.available).toBe(false);
      expect(template.html).toBe(STARTER_TEMPLATE_HTML);

      await updateTemplate().execute(template.id, { available: true });
      tenant.switchTo('tenant-a');
      await createSite(template.id);
      tenant.switchTo('platform');
      const [listed] = await new ListSiteTemplatesUseCase(keeper(), templates).execute();
      expect(listed).toMatchObject({ sites: 1 });
      expect(listed.template.available).toBe(true);
    });

    it('refuses a template whose markers cannot be read, with the reason', async () => {
      const template = await createTemplate();
      const error = await updateTemplate()
        .execute(template.id, { html: '<p>{{bad</p>' })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(InvalidSiteError);
      expect((error as InvalidSiteError).code).toBe('SITE_TEMPLATE_INVALID_HTML');
      expect((error as InvalidSiteError).message).toBe('Unclosed tag at 0');
      expect((await templates.findOwned(template.id))?.html).toBe(STARTER_TEMPLATE_HTML);
    });

    it('accounts only see available templates', async () => {
      await createTemplate({ name: 'Rascunho' });
      await availableTemplate('tenant-a', 'Pronto');
      expect(
        (await new ListAvailableTemplatesUseCase(templates).execute()).map((t) => t.name),
      ).toEqual(['Pronto']);
    });

    it('a template in use cannot be deleted', async () => {
      const used = await availableTemplate();
      await createSite(used.id);
      tenant.switchTo('platform');
      const remove = new DeleteSiteTemplateUseCase(keeper(), templates);
      await expect(remove.execute(used.id)).rejects.toThrow(SiteConflictError);
      const unused = await createTemplate({ name: 'Outro' });
      await remove.execute(unused.id);
      expect(await templates.findOwned(unused.id)).toBeNull();
    });

    it('the template preview fills every section with the sample site', async () => {
      const view = viewOf(
        await new PreviewSiteTemplateUseCase(keeper(), renderer).execute('<html>'),
      );
      expect(view.business.name).toBe('Barbearia do Zé');
      expect(Object.values(view.sections).every(Boolean)).toBe(true);
    });
  });

  describe('the account site', () => {
    it('starts from an available template with the account name and slug', async () => {
      const template = await availableTemplate();
      const { site } = await createSite(template.id);
      expect(site.slug).toBe('barbearia-do-ze');
      expect(site.content.business.name).toBe('Barbearia do Zé');
      expect(site.isLive).toBe(false);
      await expect(createSite(template.id)).rejects.toThrow(SiteConflictError);

      // Outra conta com o mesmo nome: o endereço ganha sufixo.
      tenant.switchTo('tenant-b');
      account.accounts['tenant-b'].slug = 'barbearia-do-ze';
      expect((await createSite(template.id)).site.slug).toBe('barbearia-do-ze-2');
    });

    it('a draft template cannot be chosen; a site keeps its template if it stops being available', async () => {
      tenant.switchTo('platform');
      const draft = await createTemplate({ name: 'Rascunho' });
      tenant.switchTo('tenant-a');
      await expect(createSite(draft.id)).rejects.toThrow(SiteNotFoundError);

      const template = await availableTemplate();
      await createSite(template.id);
      tenant.switchTo('platform');
      await updateTemplate().execute(template.id, { available: false });
      tenant.switchTo('tenant-a');
      await expect(
        updateSite().execute({ slug: 'barbearia', templateId: template.id }),
      ).resolves.toBeDefined();
      await expect(updateSite().execute({ templateId: draft.id })).rejects.toThrow(
        SiteNotFoundError,
      );
    });

    it('validates the address: format, reserved words and taken by another site', async () => {
      const template = await availableTemplate();
      await createSite(template.id);
      for (const [slug, code] of [
        ['Com Espaço', 'SITE_INVALID_SLUG'],
        ['ab', 'SITE_INVALID_SLUG'],
        ['media', 'SITE_RESERVED_SLUG'],
      ]) {
        await expect(updateSite().execute({ slug })).rejects.toMatchObject({ code });
      }
      tenant.switchTo('tenant-b');
      await createSite(template.id);
      await expect(updateSite().execute({ slug: 'barbearia-do-ze' })).rejects.toThrow(
        SiteConflictError,
      );
    });

    it('normalizes the content and refuses images of another account', async () => {
      const template = await availableTemplate();
      await createSite(template.id);
      const { site } = await withContent((c) => {
        c.business.whatsapp = '(15) 99999-8888';
        c.business.tagline = '   ';
        c.theme.primaryColor = '#B45309';
      });
      expect(site.content.business.whatsapp).toBe('+5515999998888');
      expect(site.content.business.tagline).toBeNull();
      expect(site.content.theme.primaryColor).toBe('#b45309');
      await expect(withContent((c) => (c.business.whatsapp = '123'))).rejects.toMatchObject({
        code: 'SITE_INVALID_WHATSAPP',
      });

      tenant.switchTo('tenant-b');
      const { asset } = await upload();
      tenant.switchTo('tenant-a');
      await expect(withContent((c) => (c.theme.logoAssetId = asset.id))).rejects.toMatchObject({
        code: 'SITE_UNKNOWN_ASSET',
      });
    });

    it('the preview uses the unsaved content, the catalog and the chosen form', async () => {
      const template = await availableTemplate();
      await createSite(template.id);
      sources.serviceItems = [
        { id: 's1', name: 'Corte', description: null, priceCents: 4500, durationMinutes: 90 },
      ];
      sources.forms.set('f1', { actionUrl: 'https://api.test/v1/public/forms/k', kind: 'contact' });
      const site = (await sites.findCurrent())!;
      const content = structuredClone(site.content);
      content.contactFormId = 'f1';
      content.sections.professionals = true; // ligada, mas sem profissionais: some

      const preview = new PreviewSiteUseCase(sites, templates, account, hosting, composer());
      const view = viewOf(await preview.execute({ content }));
      expect(view.services).toEqual([
        { id: 's1', name: 'Corte', description: null, price: 'R$\u00a045,00', duration: '1h30' },
      ]);
      expect(view.sections).toMatchObject({ services: true, professionals: false, contact: true });
      expect(view.contactForm?.html).toContain('action="https://api.test/v1/public/forms/k"');
      expect(view.site.url).toBe('https://barbearia-do-ze.sites.test');
      // Nada foi gravado.
      expect((await sites.findCurrent())?.content.contactFormId).toBeNull();
    });

    it('tenants do not see each other’s site', async () => {
      const template = await availableTemplate();
      await createSite(template.id);
      tenant.switchTo('tenant-b');
      expect((await new GetSiteUseCase(sites, templates, account).execute()).details).toBeNull();
      await expect(updateSite().execute({ slug: 'outro-nome' })).rejects.toThrow(SiteNotFoundError);
    });
  });

  describe('publication', () => {
    const ready = async () => {
      const template = await availableTemplate();
      await createSite(template.id);
      return template;
    };

    it('publishes through the queue, flags later edits and moves when the address changes', async () => {
      await ready();
      const requested = await request().execute('publish');
      expect(requested.site.pendingAction).toBe('publish');
      expect(jobs.of(ProcessSiteJob)).toHaveLength(1);

      await runJobs();
      let site = (await sites.findCurrent())!;
      expect(site.isLive).toBe(true);
      expect(site.pendingAction).toBeNull();
      expect(viewOf(hosting.pages.get('barbearia-do-ze')!).business.name).toBe('Barbearia do Zé');
      expect(site.hasUnpublishedChanges).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 5));
      ({ site } = await updateSite().execute({ slug: 'ze-barbearia' }));
      expect(site.hasUnpublishedChanges).toBe(true);
      // O endereço antigo continua reservado enquanto estiver no ar.
      tenant.switchTo('tenant-b');
      expect(await sites.isSlugTaken('barbearia-do-ze', null)).toBe(true);
      tenant.switchTo('tenant-a');

      await request().execute('publish');
      await runJobs();
      expect([...hosting.pages.keys()]).toEqual(['ze-barbearia']);
      expect((await sites.findCurrent())?.publishedSlug).toBe('ze-barbearia');

      await request().execute('unpublish');
      await runJobs();
      expect(hosting.pages.size).toBe(0);
      expect((await sites.findCurrent())?.isLive).toBe(false);
    });

    it('an edit made while the worker publishes is kept (and stays unpublished)', async () => {
      await ready();
      await request().execute('publish');
      const [{ siteId }] = jobs.of(ProcessSiteJob);
      await withContent((c) => (c.business.tagline = 'Editado no meio'));

      await process().execute(siteId);
      const site = (await sites.findCurrent())!;
      expect(site.content.business.tagline).toBe('Editado no meio');
      expect(site.isLive).toBe(true);
    });

    it('a broken template fails at once; storage errors go back to the queue', async () => {
      const template = await ready();
      tenant.switchTo('platform');
      // Gravado direto: o use case recusaria o HTML (o caso é um modelo antigo quebrado).
      const stored = (await templates.findOwned(template.id))!;
      stored.update({ html: '{{bad' });
      await templates.save(stored);
      tenant.switchTo('tenant-a');

      await request().execute('publish');
      await runJobs();
      expect((await sites.findCurrent())?.lastError).toBe('SITE_TEMPLATE_INVALID_HTML');

      tenant.switchTo('platform');
      stored.update({ html: '<html>' });
      await templates.save(stored);
      tenant.switchTo('tenant-a');
      hosting.failing = true;
      await request().execute('publish');
      const [{ siteId }] = jobs.of(ProcessSiteJob);
      await expect(process().execute(siteId)).rejects.toThrow('S3 down');
      expect((await sites.findCurrent())?.pendingAction).toBe('publish');
      await new GiveUpSiteUseCase(sites).execute(siteId);
      expect((await sites.findCurrent())?.lastError).toBe('SITE_HOSTING_UNAVAILABLE');
    });

    it('without the sites bucket configured, publishing and uploading are refused', async () => {
      await ready();
      hosting = new InMemorySiteHosting(false);
      await expect(request().execute('publish')).rejects.toMatchObject({
        code: 'SITES_NOT_CONFIGURED',
      });
      await expect(upload()).rejects.toMatchObject({ code: 'SITES_NOT_CONFIGURED' });
    });
  });

  describe('images', () => {
    it('keeps the original private and a public copy for the site', async () => {
      tenant.switchTo('tenant-a');
      const { asset, url } = await upload();
      expect(storage.files.has(`tenants/tenant-a/site-assets/${asset.id}`)).toBe(true);
      expect(hosting.media.has(`tenant-a/${asset.id}.png`)).toBe(true);
      expect(url).toBe(`https://media.sites.test/tenant-a/${asset.id}.png`);
      expect(await new ListSiteAssetsUseCase(assets, hosting).execute()).toHaveLength(1);
      tenant.switchTo('tenant-b');
      expect(await new ListSiteAssetsUseCase(assets, hosting).execute()).toHaveLength(0);
    });

    it('accepts only common images up to 5 MB', async () => {
      tenant.switchTo('tenant-a');
      await expect(upload('image/svg+xml')).rejects.toMatchObject({
        code: 'SITE_ASSET_INVALID_TYPE',
      });
      await expect(upload('image/png', Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toMatchObject({
        code: 'SITE_ASSET_TOO_LARGE',
      });
    });

    it('an image the site uses cannot be deleted; an unused one leaves both buckets', async () => {
      const template = await availableTemplate();
      await createSite(template.id);
      const { asset: logo } = await upload();
      const { asset: other } = await upload();
      await withContent((c) => (c.theme.logoAssetId = logo.id));
      const remove = new DeleteSiteAssetUseCase(assets, sites, hosting, storage);

      await expect(remove.execute(logo.id)).rejects.toThrow(SiteConflictError);
      await remove.execute(other.id);
      expect(storage.files.has(`tenants/tenant-a/site-assets/${other.id}`)).toBe(false);
      expect(hosting.media.has(`tenant-a/${other.id}.png`)).toBe(false);

      const site = (await sites.findCurrent())!;
      const view = viewOf(
        await new PreviewSiteUseCase(sites, templates, account, hosting, composer()).execute({}),
      );
      expect(view.logo).toEqual({ url: `https://media.sites.test/tenant-a/${logo.id}.png` });
      expect(site.content.theme.logoAssetId).toBe(logo.id);
    });
  });

  describe('custom domain', () => {
    let checker: FakeSiteDomainChecker;
    beforeEach(() => {
      checker = new FakeSiteDomainChecker(hosting);
    });

    const ready = async () => {
      const template = await availableTemplate();
      await createSite(template.id);
    };
    const setDomain = (customDomain: string | null) => updateSite().execute({ customDomain });
    const runChecks = async () => {
      const pending = jobs.of(CheckSiteDomainJob);
      jobs.jobs.length = 0;
      for (const { siteId } of pending) {
        await new CheckSiteDomainUseCase(sites, checker).execute(siteId);
      }
    };

    it('only whoever manages the account (or the platform) sets it, normalized', async () => {
      await ready();
      await expect(setDomain('www.barbearia.com.br')).rejects.toThrow(SiteDomainManagedAboveError);

      account.acting = true;
      const { site } = await setDomain(' https://WWW.Barbearia.com.br/ ');
      expect(site.customDomain).toBe('www.barbearia.com.br');
      expect(site.domainStatus).toBe('pending');
      expect(site.hasUnpublishedChanges).toBe(false); // ainda nem está no ar

      for (const [domain, code] of [
        ['barbearia', 'SITE_INVALID_DOMAIN'],
        ['192.168.0.1', 'SITE_INVALID_DOMAIN'],
        ['loja.sites.test', 'SITE_DOMAIN_IS_OURS'],
      ]) {
        await expect(setDomain(domain)).rejects.toMatchObject({ code });
      }
      // A plataforma define no próprio site sem ser acesso delegado.
      account.acting = false;
      tenant.switchTo('platform');
      await createSite((await templates.listAvailable())[0].id);
      await expect(setDomain('www.daedalus.com.br')).resolves.toBeDefined();
    });

    it('two sites cannot share a domain, with or without www', async () => {
      await ready();
      account.acting = true;
      await setDomain('www.barbearia.com.br');
      tenant.switchTo('tenant-b');
      await createSite((await templates.listAvailable())[0].id);
      await expect(setDomain('barbearia.com.br')).rejects.toMatchObject({
        code: 'SITE_DOMAIN_TAKEN',
      });
      await expect(setDomain('www.outra.com.br')).resolves.toBeDefined();
    });

    it('publishing writes the domain folder, the check file and the redirect without www', async () => {
      await ready();
      account.acting = true;
      const { site } = await setDomain('www.barbearia.com.br');
      await request().execute('publish');
      await runJobs();

      const html = hosting.pages.get('www.barbearia.com.br')!;
      expect(viewOf(html).site.url).toBe('https://www.barbearia.com.br');
      expect(hosting.pages.has('barbearia-do-ze')).toBe(true); // o endereço nosso continua
      expect(hosting.files.get('www.barbearia.com.br/.well-known/daedalus-site.txt')).toBe(site.id);
      expect(hosting.pages.get('barbearia.com.br')).toContain('url=https://www.barbearia.com.br/');

      // DNS ainda não aponta: não chega.
      await runChecks();
      expect((await sites.findCurrent())?.domainStatus).toBe('unreachable');
      // Apontou: "verificar de novo".
      checker.reachable.add('www.barbearia.com.br');
      const asked = await new RequestSiteDomainCheckUseCase(sites, templates, jobs).execute();
      expect(asked.site.domainStatus).toBe('checking');
      await runChecks();
      const connected = (await sites.findCurrent())!;
      expect(connected.domainStatus).toBe('connected');
      expect(connected.domainCheckedAt).toBeInstanceOf(Date);
    });

    it('changing or removing the domain takes the old one down on the next publication', async () => {
      await ready();
      account.acting = true;
      await setDomain('www.barbearia.com.br');
      await request().execute('publish');
      await runJobs();

      await setDomain('www.ze.com.br');
      await request().execute('publish');
      await runJobs();
      expect([...hosting.pages.keys()].sort()).toEqual([
        'barbearia-do-ze',
        'www.ze.com.br',
        'ze.com.br',
      ]);
      expect(hosting.files.has('www.barbearia.com.br/.well-known/daedalus-site.txt')).toBe(false);

      await request().execute('unpublish');
      await runJobs();
      expect(hosting.pages.size).toBe(0);
      expect(hosting.files.size).toBe(0);
    });

    it('a check before publishing stays pending; a check of a replaced domain is discarded', async () => {
      await ready();
      account.acting = true;
      await setDomain('www.barbearia.com.br');
      checker.reachable.add('www.barbearia.com.br');
      await new RequestSiteDomainCheckUseCase(sites, templates, jobs).execute();
      await runChecks();
      expect((await sites.findCurrent())?.domainStatus).toBe('pending');

      await request().execute('publish');
      await runJobs();
      const [{ siteId }] = jobs.of(CheckSiteDomainJob);
      jobs.jobs.length = 0;
      // Troca o domínio antes de a verificação do anterior terminar.
      const stale = (await sites.findById(siteId))!;
      await setDomain('www.ze.com.br');
      stale.markDomainChecked(true, new Date());
      await sites.saveDomainStatus(stale);
      expect((await sites.findCurrent())?.domainStatus).toBe('pending');
    });
  });
});
