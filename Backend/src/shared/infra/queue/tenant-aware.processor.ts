import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CLS_ID, ClsServiceManager } from 'nestjs-cls';
import type { JobDefinition } from '../../application/job-queue';
import type { AppClsStore } from '../context/app-cls-store';
import type { JobEnvelope } from './job-envelope';

type Handler = (payload: never) => Promise<unknown>;

/**
 * Base dos processors de fila. Antes de executar, recria o contexto da
 * operação que enfileirou o job — tenant e correlation id —, de modo que
 * repositórios, TenantContext e logs funcionem igual à API.
 *
 * Uso (num `<modulo>.worker.module.ts`):
 *
 *   @Processor('channels')
 *   export class ChannelsProcessor extends TenantAwareProcessor {
 *     constructor(private readonly handleWebhook: HandleWebhookUseCase) {
 *       super();
 *       this.on(ProcessInboundWebhookJob, (p) => this.handleWebhook.execute(p));
 *     }
 *   }
 */
export abstract class TenantAwareProcessor extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name);
  private readonly handlers = new Map<string, Handler>();

  protected on<TPayload>(
    job: JobDefinition<TPayload>,
    handler: (payload: TPayload) => Promise<unknown>,
  ) {
    this.handlers.set(job.name, handler);
  }

  async process(job: Job<JobEnvelope>): Promise<unknown> {
    const handler = this.handlers.get(job.name);
    if (!handler) throw new Error(`No handler for job "${job.name}" on queue "${job.queueName}"`);

    return this.inJobContext(job, async () => {
      const startedAt = Date.now();
      try {
        const result = await handler(job.data.payload as never);
        this.logger.log(
          `${job.queueName}/${job.name} #${job.id} ok em ${Date.now() - startedAt}ms`,
        );
        return result;
      } catch (error) {
        this.logger.warn(
          `${job.queueName}/${job.name} #${job.id} falhou (tentativa ${job.attemptsMade + 1}/${job.opts.attempts ?? 1}): ${String(error)}`,
        );
        throw error;
      }
    });
  }

  /**
   * Roda `work` no contexto de quem enfileirou o job (tenant e correlation
   * id). Também para os ganchos de evento do worker (ex.: `failed`), que o
   * BullMQ chama fora do `process`.
   */
  protected inJobContext<T>(job: Job<JobEnvelope>, work: () => Promise<T>): Promise<T> {
    const { meta } = job.data;
    const cls = ClsServiceManager.getClsService<AppClsStore>();
    return cls.run(() => {
      cls.set(CLS_ID, meta.correlationId ?? `job:${job.queueName}:${job.id}`);
      if (meta.tenantId) cls.set('tenantId', meta.tenantId);
      return work();
    });
  }
}
