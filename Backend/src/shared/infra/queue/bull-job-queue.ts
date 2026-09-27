import { getQueueToken } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import type { EnqueueOptions, JobDefinition, JobQueue } from '../../application/job-queue';
import type { AppClsStore } from '../context/app-cls-store';
import type { JobEnvelope } from './job-envelope';

const DEFAULT_ATTEMPTS = 5;

/**
 * Adapter do port JobQueue sobre o BullMQ. Cada módulo registra as próprias
 * filas (`BullModule.registerQueue`); aqui elas são localizadas pelo nome.
 */
@Injectable()
export class BullJobQueue implements JobQueue {
  private readonly queues = new Map<string, Queue>();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async add<TPayload>(
    job: JobDefinition<TPayload>,
    payload: TPayload,
    options: EnqueueOptions = {},
  ): Promise<void> {
    const envelope: JobEnvelope<TPayload> = { v: 1, payload, meta: this.currentMeta() };

    await this.queue(job.queue).add(job.name, envelope, {
      // O BullMQ usa ":" para montar as chaves no Redis e recusa ids com ":".
      // Trocamos aqui, para que quem enfileira não precise saber disso.
      jobId: options.jobId?.replaceAll(':', '|'),
      delay: options.delayMs,
      attempts: options.attempts ?? DEFAULT_ATTEMPTS,
      backoff: { type: 'exponential', delay: 2_000 },
      // Mantém histórico curto no Redis; falhas ficam mais tempo para análise.
      removeOnComplete: { age: 24 * 3600, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    });
  }

  private currentMeta(): JobEnvelope['meta'] {
    if (!this.cls.isActive()) return {};
    return {
      tenantId: this.cls.get('actor')?.tenantId ?? this.cls.get('tenantId'),
      correlationId: this.cls.getId(),
    };
  }

  private queue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = this.moduleRef.get<Queue>(getQueueToken(name), { strict: false });
      this.queues.set(name, queue);
    }
    return queue;
  }
}
