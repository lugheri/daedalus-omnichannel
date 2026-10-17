import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { JobEnvelope } from '../../../shared/infra/queue/job-envelope';
import { TenantAwareProcessor } from '../../../shared/infra/queue/tenant-aware.processor';
import { ProcessSiteJob, SITES_QUEUE } from '../application/sites-jobs';
import { GiveUpSiteUseCase, ProcessSiteUseCase } from '../application/use-cases/site.use-cases';

/** Fila dos sites (worker): publicar e tirar do ar. */
@Processor(SITES_QUEUE, { concurrency: 5 })
export class SitesProcessor extends TenantAwareProcessor {
  constructor(
    process: ProcessSiteUseCase,
    private readonly giveUp: GiveUpSiteUseCase,
  ) {
    super();
    this.on(ProcessSiteJob, ({ siteId }) => process.execute(siteId));
  }

  /** Esgotou as tentativas (bucket fora do ar): o site sai de "publicando" com o motivo. */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobEnvelope<{ siteId?: string }>> | undefined): Promise<void> {
    if (!job || job.name !== ProcessSiteJob.name) return;
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const siteId = job.data.payload.siteId;
    if (!siteId) return;
    await this.inJobContext(job, () => this.giveUp.execute(siteId));
  }
}
