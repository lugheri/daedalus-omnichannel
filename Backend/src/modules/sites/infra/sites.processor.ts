import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { JobEnvelope } from '../../../shared/infra/queue/job-envelope';
import { TenantAwareProcessor } from '../../../shared/infra/queue/tenant-aware.processor';
import {
  CheckSiteDomainJob,
  ProcessLandingJob,
  ProcessSiteJob,
  SITES_QUEUE,
} from '../application/sites-jobs';
import {
  GiveUpLandingUseCase,
  ProcessLandingUseCase,
} from '../application/use-cases/landing-pages.use-cases';
import {
  CheckSiteDomainUseCase,
  GiveUpSiteUseCase,
  ProcessSiteUseCase,
} from '../application/use-cases/site.use-cases';

/** Fila dos sites (worker): publicar e tirar do ar (sites e landing pages) e verificar o domínio. */
@Processor(SITES_QUEUE, { concurrency: 5 })
export class SitesProcessor extends TenantAwareProcessor {
  constructor(
    process: ProcessSiteUseCase,
    private readonly giveUp: GiveUpSiteUseCase,
    checkDomain: CheckSiteDomainUseCase,
    processLanding: ProcessLandingUseCase,
    private readonly giveUpLanding: GiveUpLandingUseCase,
  ) {
    super();
    this.on(ProcessSiteJob, ({ siteId }) => process.execute(siteId));
    this.on(CheckSiteDomainJob, ({ siteId }) => checkDomain.execute(siteId));
    this.on(ProcessLandingJob, ({ landingPageId }) => processLanding.execute(landingPageId));
  }

  /** Esgotou as tentativas (bucket fora do ar): o site sai de "publicando" com o motivo. */
  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<JobEnvelope<{ siteId?: string; landingPageId?: string }>> | undefined,
  ): Promise<void> {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const { siteId, landingPageId } = job.data.payload;
    if (job.name === ProcessSiteJob.name && siteId) {
      await this.inJobContext(job, () => this.giveUp.execute(siteId));
    }
    if (job.name === ProcessLandingJob.name && landingPageId) {
      await this.inJobContext(job, () => this.giveUpLanding.execute(landingPageId));
    }
  }
}
