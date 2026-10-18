import { Inject, Injectable } from '@nestjs/common';
import { JOB_QUEUE, type JobQueue } from '../../../shared/application/job-queue';
import type { LandingPage } from '../domain/landing-page.entity';
import type { Site } from '../domain/site.entity';
import {
  LANDING_PAGE_REPOSITORY,
  type LandingPageRepository,
} from './ports/landing-page.repository';
import { SITE_HOSTING, type SiteHosting } from './ports/site-hosting';
import { ProcessLandingJob } from './sites-jobs';

/**
 * Onde as landing pages da conta moram: nas pastas do site — o endereço
 * nosso (o publicado, ou o atual se o site nunca foi ao ar) e o domínio
 * próprio publicado. O endereço principal é o domínio, se houver.
 */
export function landingLocation(hosting: SiteHosting, site: Site) {
  const slug = site.publishedSlug ?? site.slug;
  const base = site.publishedDomain
    ? hosting.domainUrl(site.publishedDomain)
    : hosting.enabled
      ? hosting.siteUrl(slug)
      : null;
  return {
    folders: [slug, ...(site.publishedDomain ? [site.publishedDomain] : [])],
    pageUrl: (path: string) => (base ? `${base}/${path}/` : null),
    homeUrl: site.isLive ? base : null,
  };
}

/** Pede ao worker que publique de novo (ou tire do ar). */
export async function requestLandingPublication(
  page: LandingPage,
  action: 'publish' | 'unpublish',
  pages: LandingPageRepository,
  jobs: JobQueue,
): Promise<void> {
  if (action === 'publish') page.requestPublish();
  else page.requestUnpublish();
  await pages.savePublication(page);
  await jobs.add(ProcessLandingJob, { landingPageId: page.id });
}

/**
 * O site mudou de endereço (slug ou domínio publicados): as landing pages no
 * ar vão junto (publicar de novo grava nas pastas novas e tira das antigas).
 */
@Injectable()
export class LandingRelocator {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  /**
   * `everyLive`: o site entrou ou saiu do ar — todas as no ar são publicadas
   * de novo (o link "voltar ao site" aparece ou some), mesmo sem mudar de pasta.
   */
  async relocate(site: Site, options: { everyLive?: boolean } = {}): Promise<void> {
    const folders = landingLocation(this.hosting, site).folders;
    for (const page of await this.pages.listLive()) {
      const same =
        page.publishedFolders.length === folders.length &&
        folders.every((f) => page.publishedFolders.includes(f));
      if ((same && !options.everyLive) || page.pendingAction) continue;
      await requestLandingPublication(page, 'publish', this.pages, this.jobs);
    }
  }
}
