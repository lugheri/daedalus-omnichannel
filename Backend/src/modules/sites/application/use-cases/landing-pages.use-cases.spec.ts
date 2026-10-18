import {
  FakeTenantContext,
  InMemoryFileStorage,
  RecordingJobQueue,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { compareVariants } from '../../domain/ab-test';
import { SiteConflictError } from '../../domain/errors/site-conflict.error';
import type { LandingContent } from '../../domain/landing-content';
import {
  FakeLandingBeacon,
  FakeSiteAccount,
  FakeSiteSources,
  InMemoryLandingPageRepository,
  InMemoryLandingStatsRepository,
  InMemorySiteAssetRepository,
  InMemorySiteHosting,
  InMemorySiteRepository,
  InMemorySiteTemplateRepository,
  JsonSiteRenderer,
} from '../../testing/fakes';
import { LandingConversionHandler } from '../event-handlers/landing-conversion.handler';
import { LandingComposer } from '../landing-composer';
import { LandingRelocator } from '../landing-location';
import type { LandingView } from '../landing-view';
import { SiteComposer } from '../site-composer';
import { ProcessLandingJob, ProcessSiteJob } from '../sites-jobs';
import {
  AddLandingVariantUseCase,
  ChooseLandingWinnerUseCase,
  CreateLandingPageUseCase,
  DeleteLandingPageUseCase,
  LandingStatsUseCase,
  ListLandingPagesUseCase,
  PreviewLandingUseCase,
  ProcessLandingUseCase,
  RecordLandingViewUseCase,
  RemoveLandingVariantUseCase,
  RequestLandingPublicationUseCase,
  ResetLandingStatsUseCase,
  UpdateLandingPageUseCase,
  UpdateLandingVariantUseCase,
} from './landing-pages.use-cases';
import { DeleteSiteAssetUseCase, UploadSiteAssetUseCase } from './site-assets.use-cases';
import {
  CreateSiteTemplateUseCase,
  PreviewSiteTemplateUseCase,
  TemplateKeeper,
  UpdateSiteTemplateUseCase,
} from './site-templates.use-cases';
import {
  CreateSiteUseCase,
  ProcessSiteUseCase,
  RequestSitePublicationUseCase,
  UpdateSiteUseCase,
} from './site.use-cases';

describe('Landing pages', () => {
  let tenant: FakeTenantContext;
  let account: FakeSiteAccount;
  let sites: InMemorySiteRepository;
  let pages: InMemoryLandingPageRepository;
  let stats: InMemoryLandingStatsRepository;
  let templates: InMemorySiteTemplateRepository;
  let assets: InMemorySiteAssetRepository;
  let hosting: InMemorySiteHosting;
  let sources: FakeSiteSources;
  let renderer: JsonSiteRenderer;
  let jobs: RecordingJobQueue;
  let ids: SequentialIdGenerator;

  beforeEach(() => {
    tenant = new FakeTenantContext('platform');
    account = new FakeSiteAccount(tenant, {
      platform: { name: 'Daedalus', slug: 'daedalus', isRoot: true },
      'tenant-a': { name: 'Barbearia do Zé', slug: 'barbearia-do-ze', isRoot: false },
      'tenant-b': { name: 'Outra', slug: 'outra', isRoot: false },
    });
    sites = new InMemorySiteRepository(tenant);
    pages = new InMemoryLandingPageRepository(tenant);
    stats = new InMemoryLandingStatsRepository(tenant);
    templates = new InMemorySiteTemplateRepository(tenant, sites, pages);
    assets = new InMemorySiteAssetRepository(tenant);
    hosting = new InMemorySiteHosting();
    sources = new FakeSiteSources();
    sources.forms.set('form-1', {
      actionUrl: 'https://api.test/v1/public/forms/chave',
      kind: 'contact',
    });
    renderer = new JsonSiteRenderer();
    jobs = new RecordingJobQueue();
    ids = new SequentialIdGenerator();
  });

  const keeper = () => new TemplateKeeper(account);
  const template = async (kind: 'site' | 'landing', name: string) => {
    tenant.switchTo('platform');
    const created = await new CreateSiteTemplateUseCase(
      keeper(),
      templates,
      renderer,
      tenant,
      ids,
    ).execute({ name, kind, niche: null, description: null, html: '<html></html>' });
    await new UpdateSiteTemplateUseCase(keeper(), templates, renderer).execute(created.id, {
      available: true,
    });
    tenant.switchTo('tenant-a');
    return created;
  };
  const relocator = () => new LandingRelocator(pages, hosting, jobs);
  const landingComposer = () =>
    new LandingComposer(sources, assets, hosting, renderer, new FakeLandingBeacon());
  const processSite = () =>
    new ProcessSiteUseCase(
      sites,
      templates,
      hosting,
      jobs,
      new SiteComposer(sources, assets, hosting, renderer),
      relocator(),
    );
  const process = () =>
    new ProcessLandingUseCase(pages, sites, templates, hosting, landingComposer());
  /** Roda os jobs pendentes (sites e landing pages), como o worker. */
  const runJobs = async () => {
    while (
      jobs.jobs.some((j) => j.name === ProcessSiteJob.name || j.name === ProcessLandingJob.name)
    ) {
      const pending = [...jobs.jobs];
      jobs.jobs.splice(0, jobs.jobs.length);
      for (const job of pending) {
        if (job.name === ProcessSiteJob.name) {
          await processSite().execute((job.payload as { siteId: string }).siteId);
        }
        if (job.name === ProcessLandingJob.name) {
          await process().execute((job.payload as { landingPageId: string }).landingPageId);
        }
      }
    }
  };
  const create = (input: { path?: string; templateId: string; formId?: string | null }) =>
    new CreateLandingPageUseCase(pages, sites, templates, sources, hosting, tenant, ids).execute({
      name: 'Dia dos Pais',
      path: input.path ?? 'dia-dos-pais',
      templateId: input.templateId,
      formId: input.formId === undefined ? 'form-1' : input.formId,
    });
  const publication = () =>
    new RequestLandingPublicationUseCase(pages, sites, templates, hosting, jobs);
  const updateVariant = () =>
    new UpdateLandingVariantUseCase(pages, sites, templates, assets, hosting);
  /** O HTML publicado é o view em JSON + o script do aviso de visita. */
  const viewOf = (html: string) =>
    JSON.parse(html.slice(0, html.indexOf('\n<script'))) as LandingView;
  const setup = async () => {
    const siteTemplate = await template('site', 'Clássico');
    const landingTemplate = await template('landing', 'Oferta');
    await new CreateSiteUseCase(sites, templates, account, tenant, ids).execute({
      templateId: siteTemplate.id,
    });
    return { siteTemplate, landingTemplate };
  };
  const contentOf = async (id: string, change: (c: LandingContent) => void, variant = 0) => {
    const page = (await pages.findById(id))!;
    const content = structuredClone(page.variants[variant].content);
    change(content);
    return updateVariant().execute(id, page.variants[variant].id, { content });
  };

  describe('creating', () => {
    it('needs the site, a landing template, a valid and free path', async () => {
      const landingTemplate = await template('landing', 'Oferta');
      await expect(create({ templateId: landingTemplate.id })).rejects.toMatchObject({
        code: 'LANDING_SITE_REQUIRED',
      });
      const { siteTemplate } = await setup();
      await expect(create({ templateId: siteTemplate.id })).rejects.toMatchObject({
        code: 'SITE_TEMPLATE_WRONG_KIND',
      });
      await expect(
        create({ templateId: landingTemplate.id, path: 'Promo Natal!' }),
      ).rejects.toMatchObject({ code: 'LANDING_INVALID_PATH' });
      await expect(
        create({ templateId: landingTemplate.id, formId: 'nao-existe' }),
      ).rejects.toMatchObject({ code: 'LANDING_UNKNOWN_FORM' });

      const { page, url } = await create({
        templateId: landingTemplate.id,
        path: '/Dia-dos-Pais/',
      });
      expect(page.path).toBe('dia-dos-pais');
      expect(url).toBe('https://barbearia-do-ze.sites.test/dia-dos-pais/');
      expect(page.variants.map((v) => [v.code, v.weight])).toEqual([['a', 50]]);
      expect(page.variants[0].content.hero.title).toBe('Barbearia do Zé: oferta especial');
      await expect(create({ templateId: landingTemplate.id })).rejects.toThrow(SiteConflictError);
    });

    it('the site picks only site templates; the template list is by kind', async () => {
      const { landingTemplate } = await setup();
      await expect(
        new UpdateSiteUseCase(sites, templates, assets, account, hosting, relocator()).execute({
          templateId: landingTemplate.id,
        }),
      ).rejects.toMatchObject({ code: 'SITE_TEMPLATE_WRONG_KIND' });
      expect((await templates.listAvailable('landing')).map((t) => t.name)).toEqual(['Oferta']);
      // A prévia do modelo de landing usa a landing de exemplo.
      tenant.switchTo('platform');
      const preview = JSON.parse(
        await new PreviewSiteTemplateUseCase(keeper(), renderer).execute('<html>', 'landing'),
      ) as LandingView;
      expect(preview.sections).toMatchObject({ benefits: true, offer: true, form: true });
      expect(preview.offer).toMatchObject({ price: 'R$ 49,00', oldPrice: 'R$ 70,00' });
    });
  });

  describe('publishing and A/B test', () => {
    it('one variant: the page itself, with the form tagged and the view beacon', async () => {
      const { landingTemplate } = await setup();
      const { page } = await create({ templateId: landingTemplate.id });
      await contentOf(page.id, (c) => {
        c.benefits = [
          { title: 'Toalha quente', text: null },
          { title: '  ', text: 'vazio sai' },
        ];
        c.offer = { title: 'Corte + barba', price: 'R$ 49,00', oldPrice: null, note: null };
      });

      // Prévia: sem aviso de visita e sem a marca da variante no formulário.
      const preview = JSON.parse(
        await new PreviewLandingUseCase(
          pages,
          sites,
          templates,
          hosting,
          landingComposer(),
        ).execute(page.id, { variantId: page.variants[0].id }),
      ) as LandingView;
      expect(preview.contactForm?.action).toBe('https://api.test/v1/public/forms/chave');

      await publication().execute(page.id, 'publish');
      await runJobs();
      const html = hosting.pages.get('barbearia-do-ze/dia-dos-pais')!;
      const view = viewOf(html);
      const variantId = page.variants[0].id;
      expect(view.contactForm?.action).toBe(
        `https://api.test/v1/public/forms/chave?ref=lp%3A${variantId}`,
      );
      expect(view.benefits).toEqual([{ title: 'Toalha quente', text: null }]);
      expect(view.sections).toMatchObject({ benefits: true, offer: true, form: true, faq: false });
      expect(view.hero.ctaUrl).toBe('#formulario');
      expect(view.site.url).toBe('https://barbearia-do-ze.sites.test/dia-dos-pais/');
      expect(view.site.homeUrl).toBeNull(); // o site em si não está no ar
      expect(html).toContain(`https://api.test/v1/public/landing/views/${variantId}`);
      const live = (await pages.findById(page.id))!;
      expect(live).toMatchObject({
        isLive: true,
        publishedPath: 'dia-dos-pais',
        publishedFolders: ['barbearia-do-ze'],
        publishedCodes: [],
      });
    });

    it('two variants: the split page, each variant in its folder; the winner ends the test', async () => {
      const { landingTemplate } = await setup();
      const { page } = await create({ templateId: landingTemplate.id });
      const added = await new AddLandingVariantUseCase(
        pages,
        sites,
        templates,
        hosting,
        ids,
      ).execute(page.id, { copyFrom: null });
      const [a, b] = added.details.page.variants;
      expect(b).toMatchObject({ code: 'b', name: 'Variante B', weight: 50 });
      await updateVariant().execute(page.id, b.id, { weight: 30 });
      await contentOf(page.id, (c) => (c.hero.title = 'Título B'), 1);

      await publication().execute(page.id, 'publish');
      await runJobs();
      const split = hosting.pages.get('barbearia-do-ze/dia-dos-pais')!;
      expect(split).toContain('[["a",50],["b",30]]');
      expect(split).toContain('location.replace("/dia-dos-pais/"');
      expect(viewOf(hosting.pages.get('barbearia-do-ze/dia-dos-pais/a')!).landing.variant).toBe(
        'a',
      );
      expect(viewOf(hosting.pages.get('barbearia-do-ze/dia-dos-pais/b')!).hero.title).toBe(
        'Título B',
      );
      expect((await pages.findById(page.id))!.publishedCodes).toEqual(['a', 'b']);

      // Vencedor: no ar, publica na hora — só ele no endereço; as pastas viram redirecionamento.
      const won = await new ChooseLandingWinnerUseCase(
        pages,
        sites,
        templates,
        hosting,
        jobs,
      ).execute(page.id, b.id);
      expect(won.page.variants.map((v) => v.weight)).toEqual([0, 100]);
      await runJobs();
      expect(viewOf(hosting.pages.get('barbearia-do-ze/dia-dos-pais')!).hero.title).toBe(
        'Título B',
      );
      expect(hosting.pages.get('barbearia-do-ze/dia-dos-pais/a')).toContain('url=/dia-dos-pais/');
      expect(hosting.pages.get('barbearia-do-ze/dia-dos-pais/b')).toContain('url=/dia-dos-pais/');
      expect((await pages.findById(page.id))!.publishedCodes.sort()).toEqual(['a', 'b']);

      // Sem peso nenhum não dá; a última variante não sai.
      await expect(updateVariant().execute(page.id, b.id, { weight: 0 })).rejects.toMatchObject({
        code: 'LANDING_NO_ACTIVE_VARIANT',
      });
      const remove = new RemoveLandingVariantUseCase(pages, stats, sites, templates, hosting);
      await remove.execute(page.id, a.id);
      await expect(remove.execute(page.id, b.id)).rejects.toMatchObject({
        code: 'LANDING_LAST_VARIANT',
      });

      // Tirar do ar apaga tudo o que foi gravado (inclusive os redirecionamentos).
      await publication().execute(page.id, 'unpublish');
      await runJobs();
      expect([...hosting.pages.keys()].filter((k) => k.includes('dia-dos-pais'))).toEqual([]);
      await new DeleteLandingPageUseCase(pages, stats).execute(page.id);
      expect(await pages.findById(page.id)).toBeNull();
    });

    it('a live page cannot be deleted; changing the path moves it on the next publish', async () => {
      const { landingTemplate } = await setup();
      const { page } = await create({ templateId: landingTemplate.id });
      await publication().execute(page.id, 'publish');
      await runJobs();
      await expect(
        new DeleteLandingPageUseCase(pages, stats).execute(page.id),
      ).rejects.toMatchObject({
        code: 'LANDING_IS_LIVE',
      });
      await new UpdateLandingPageUseCase(pages, sites, templates, sources, hosting).execute(
        page.id,
        {
          path: 'natal',
        },
      );
      await publication().execute(page.id, 'publish');
      await runJobs();
      expect(hosting.pages.has('barbearia-do-ze/natal')).toBe(true);
      expect(hosting.pages.has('barbearia-do-ze/dia-dos-pais')).toBe(false);
    });

    it('when the site changes address, live landing pages follow it', async () => {
      const { landingTemplate } = await setup();
      const { page } = await create({ templateId: landingTemplate.id });
      await publication().execute(page.id, 'publish');
      await runJobs();

      const site = (await sites.findCurrent())!;
      await new UpdateSiteUseCase(sites, templates, assets, account, hosting, relocator()).execute({
        slug: 'barbearia-ze',
      });
      await runJobs();
      expect(hosting.pages.has('barbearia-ze/dia-dos-pais')).toBe(true);
      expect(hosting.pages.has('barbearia-do-ze/dia-dos-pais')).toBe(false);

      // Site publicado (agora com endereço próprio): a landing aponta o site como "home".
      await new RequestSitePublicationUseCase(sites, templates, hosting, jobs).execute('publish');
      await runJobs();
      expect(site.id).toBeDefined();
      await publication().execute(page.id, 'publish');
      await runJobs();
      expect(viewOf(hosting.pages.get('barbearia-ze/dia-dos-pais')!).site.homeUrl).toBe(
        'https://barbearia-ze.sites.test',
      );
    });

    it('when the site goes live (same address), live landing pages get the link back to it', async () => {
      const { landingTemplate } = await setup();
      const { page } = await create({ templateId: landingTemplate.id });
      await publication().execute(page.id, 'publish');
      await runJobs();
      expect(viewOf(hosting.pages.get('barbearia-do-ze/dia-dos-pais')!).site.homeUrl).toBeNull();

      await new RequestSitePublicationUseCase(sites, templates, hosting, jobs).execute('publish');
      await runJobs();
      expect(viewOf(hosting.pages.get('barbearia-do-ze/dia-dos-pais')!).site.homeUrl).toBe(
        'https://barbearia-do-ze.sites.test',
      );
      await new RequestSitePublicationUseCase(sites, templates, hosting, jobs).execute('unpublish');
      await runJobs();
      expect(viewOf(hosting.pages.get('barbearia-do-ze/dia-dos-pais')!).site.homeUrl).toBeNull();
    });

    it('an image used by a landing page cannot be deleted', async () => {
      const { landingTemplate } = await setup();
      const { page } = await create({ templateId: landingTemplate.id });
      const storage = new InMemoryFileStorage();
      const { asset } = await new UploadSiteAssetUseCase(
        assets,
        hosting,
        storage,
        tenant,
        ids,
      ).execute({
        content: Buffer.from('89504e47', 'hex'),
        contentType: 'image/png',
        fileName: 'capa.png',
      });
      await contentOf(page.id, (c) => (c.heroImageAssetId = asset.id));
      await expect(
        new DeleteSiteAssetUseCase(assets, sites, pages, hosting, storage).execute(asset.id),
      ).rejects.toMatchObject({ code: 'SITE_ASSET_IN_USE' });
      await expect(
        contentOf(page.id, (c) => (c.heroImageAssetId = 'nao-existe')),
      ).rejects.toMatchObject({ code: 'SITE_UNKNOWN_ASSET' });
    });
  });

  describe('numbers', () => {
    const live = async () => {
      const { landingTemplate } = await setup();
      const { page } = await create({ templateId: landingTemplate.id });
      const { details } = await new AddLandingVariantUseCase(
        pages,
        sites,
        templates,
        hosting,
        ids,
      ).execute(page.id, { copyFrom: null });
      return { page: details.page, a: details.page.variants[0], b: details.page.variants[1] };
    };
    const view = (variantId: string, day = '2026-10-19') =>
      new RecordLandingViewUseCase(pages, stats, tenant).execute(
        variantId,
        new Date(`${day}T12:00:00Z`),
      );
    const handler = () => new LandingConversionHandler(pages, stats);
    const submitted = (submissionId: string, tenantId: string, sourceRef: string | null) =>
      handler().handle({
        eventId: `evt-${submissionId}`,
        eventName: 'form.submitted.v1',
        aggregateId: submissionId,
        occurredAt: '2026-10-19T12:00:00.000Z',
        tenantId,
        formId: 'form-1',
        kind: 'contact',
        contactId: 'contact-1',
        service: null,
        sourceRef,
      });

    it('views count only while live; conversions come from the form, once per submission', async () => {
      const { page, a, b } = await live();
      tenant.switchTo(null);
      await view(a.id); // fora do ar: não conta
      tenant.switchTo('tenant-a');
      expect((await stats.totals([a.id])).size).toBe(0);

      await publication().execute(page.id, 'publish');
      await runJobs();
      tenant.switchTo(null);
      await view(a.id);
      await view(a.id);
      await view(b.id, '2026-10-20');
      expect(tenant.tenantId).toBe('tenant-a'); // a variante disse a conta
      await submitted('sub-1', 'tenant-a', `lp:${b.id}`);
      await submitted('sub-1', 'tenant-a', `lp:${b.id}`); // evento repetido
      await submitted('sub-2', 'tenant-a', null); // formulário do site, não da landing
      await submitted('sub-3', 'tenant-b', `lp:${a.id}`); // ref de outra conta: ignora

      const numbers = await new LandingStatsUseCase(pages, stats).execute(page.id);
      expect(
        numbers.variants.map((v) => [
          v.variant.code,
          v.numbers.views,
          v.numbers.conversions,
          v.rate,
        ]),
      ).toEqual([
        ['a', 2, 0, 0],
        ['b', 1, 1, 1],
      ]);
      expect(numbers.variants[0].comparison).toBeNull();
      expect(numbers.variants[1].comparison).toMatchObject({ verdict: 'insufficient' });
      const list = await new ListLandingPagesUseCase(pages, stats, sites, hosting).execute();
      expect(list.pages[0].numbers).toEqual({ views: 3, conversions: 1 });

      await new ResetLandingStatsUseCase(pages, stats).execute(page.id);
      expect((await stats.totals([a.id, b.id])).size).toBe(0);
    });

    it('the comparison says when the difference is reliable', () => {
      expect(
        compareVariants({ views: 50, conversions: 5 }, { views: 50, conversions: 20 }),
      ).toMatchObject({ verdict: 'insufficient' });
      expect(
        compareVariants({ views: 1000, conversions: 50 }, { views: 1000, conversions: 52 }),
      ).toMatchObject({ verdict: 'inconclusive' });
      const better = compareVariants(
        { views: 1000, conversions: 50 },
        { views: 1000, conversions: 90 },
      );
      expect(better.verdict).toBe('better');
      expect(better.lift).toBeCloseTo(0.8);
      expect(better.pValue!).toBeLessThan(0.01);
      expect(
        compareVariants({ views: 1000, conversions: 90 }, { views: 1000, conversions: 50 }).verdict,
      ).toBe('worse');
    });
  });
});
