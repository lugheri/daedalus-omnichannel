import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import {
  WhatsAppConnectionChanged,
  WhatsAppMessageReceived,
  WhatsAppMessageSendResult,
  type WhatsAppConnectionStatus,
} from '../../contracts/whatsapp-connector.contract';
import {
  JOB_QUEUE,
  type EnqueueOptions,
  type JobDefinition,
  type JobQueue,
} from '../../shared/application/job-queue';
import type { AppClsStore } from '../../shared/infra/context/app-cls-store';
import type { NormalizedMessage } from './message-normalizer';

/**
 * Envia os relatos do conector para o worker (fila `whatsapp-events`).
 * Cada relato é enfileirado no contexto do tenant do canal, para que o
 * processor do outro lado já rode no tenant certo.
 */
@Injectable()
export class ConnectorReporter {
  constructor(
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  connection(
    session: { channelId: string; tenantId: string },
    status: WhatsAppConnectionStatus,
    details: { phoneNumber?: string | null; reason?: string | null } = {},
  ): Promise<void> {
    return this.send(session.tenantId, WhatsAppConnectionChanged, {
      ...session,
      status,
      phoneNumber: details.phoneNumber ?? null,
      reason: details.reason ?? null,
      at: new Date().toISOString(),
    });
  }

  message(session: { channelId: string; tenantId: string }, message: NormalizedMessage) {
    // Dedup: o mesmo id do WhatsApp nunca vira dois jobs.
    return this.send(
      session.tenantId,
      WhatsAppMessageReceived,
      { ...session, ...message },
      { jobId: `wa-msg:${session.channelId}:${message.externalId}` },
    );
  }

  sendResult(
    session: { channelId: string; tenantId: string },
    result: { messageId: string; externalId: string | null; error: string | null },
  ) {
    return this.send(
      session.tenantId,
      WhatsAppMessageSendResult,
      { ...session, ...result, status: result.error ? 'failed' : 'sent' },
      { jobId: `wa-sent:${result.messageId}` },
    );
  }

  private send<T>(tenantId: string, job: JobDefinition<T>, payload: T, options?: EnqueueOptions) {
    return this.cls.run(() => {
      this.cls.set('tenantId', tenantId);
      return this.jobs.add(job, payload, { attempts: 8, ...options });
    });
  }
}
