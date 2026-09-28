import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  PurgeWhatsAppSession,
  SendWhatsAppMedia,
  SendWhatsAppText,
  StartWhatsAppSession,
  StopWhatsAppSession,
  WHATSAPP_CONNECTOR_QUEUE,
} from '../../contracts/whatsapp-connector.contract';
import { FILE_STORAGE, type FileStorage } from '../../shared/application/file-storage';
import type { JobPayload } from '../../shared/application/job-queue';
import type { JobEnvelope } from '../../shared/infra/queue/job-envelope';
import { TenantAwareProcessor } from '../../shared/infra/queue/tenant-aware.processor';
import { ConnectorReporter } from './connector-reporter';
import { SessionManager, SessionOwnedElsewhereError } from './session-manager';
import type { WhatsAppSession } from './whatsapp-session';

/** Erros de envio que não adianta repetir (o número não existe, o arquivo sumiu...). */
const PERMANENT_SEND_ERRORS = new Set(['not_on_whatsapp', 'media_not_found']);

type SendPayload = JobPayload<typeof SendWhatsAppText> | JobPayload<typeof SendWhatsAppMedia>;

/** Comandos vindos do sistema (API/worker) para o conector. */
@Processor(WHATSAPP_CONNECTOR_QUEUE, { concurrency: 10 })
export class ConnectorCommandsProcessor extends TenantAwareProcessor {
  constructor(
    private readonly sessions: SessionManager,
    private readonly reporter: ConnectorReporter,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {
    super();
    this.on(StartWhatsAppSession, ({ channelId, tenantId }) =>
      this.sessions.start(channelId, tenantId),
    );
    this.on(StopWhatsAppSession, ({ channelId, logout }) => this.sessions.stop(channelId, logout));
    this.on(PurgeWhatsAppSession, ({ channelId }) => this.sessions.purge(channelId));
    this.on(SendWhatsAppText, (payload) =>
      this.send(payload, (session) => session.sendText(payload.to, payload.text)),
    );
    this.on(SendWhatsAppMedia, (payload) =>
      this.send(payload, async (session) => {
        const content = await this.storage.read(payload.media.key);
        if (!content) throw new Error('media_not_found');
        return session.sendMedia(payload.to, {
          kind: payload.kind,
          content,
          mimeType: payload.media.mimeType,
          fileName: payload.media.fileName,
          caption: payload.caption,
        });
      }),
    );
  }

  /** Envia pela sessão local e relata o resultado; erros transitórios voltam para a fila. */
  private async send(
    payload: SendPayload,
    deliver: (session: WhatsAppSession) => Promise<string>,
  ): Promise<void> {
    const session = this.sessions.connectedSession(payload.channelId);
    // Sem sessão conectada aqui: ou outra instância é a dona, ou o número está
    // reconectando. Em ambos os casos, falhar faz o job voltar para a fila.
    if (!session) throw new SessionOwnedElsewhereError(payload.channelId);

    try {
      const externalId = await deliver(session);
      await this.reporter.sendResult(payload, {
        messageId: payload.messageId,
        externalId,
        error: null,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (!PERMANENT_SEND_ERRORS.has(reason)) throw error;
      await this.reporter.sendResult(payload, {
        messageId: payload.messageId,
        externalId: null,
        error: reason,
      });
    }
  }

  /** Esgotadas as tentativas de envio, o sistema precisa saber que falhou. */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobEnvelope>, error: Error): Promise<void> {
    if (job.name !== SendWhatsAppText.name && job.name !== SendWhatsAppMedia.name) return;
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const payload = job.data.payload as SendPayload;
    await this.reporter.sendResult(payload, {
      messageId: payload.messageId,
      externalId: null,
      error: error instanceof SessionOwnedElsewhereError ? 'not_connected' : error.message,
    });
  }
}
