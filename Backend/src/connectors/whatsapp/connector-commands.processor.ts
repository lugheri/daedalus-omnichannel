import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  PurgeWhatsAppSession,
  SendWhatsAppText,
  StartWhatsAppSession,
  StopWhatsAppSession,
  WHATSAPP_CONNECTOR_QUEUE,
} from '../../contracts/whatsapp-connector.contract';
import type { JobPayload } from '../../shared/application/job-queue';
import type { JobEnvelope } from '../../shared/infra/queue/job-envelope';
import { TenantAwareProcessor } from '../../shared/infra/queue/tenant-aware.processor';
import { ConnectorReporter } from './connector-reporter';
import { SessionManager, SessionOwnedElsewhereError } from './session-manager';

/** Erros de envio que não adianta repetir (o número não existe, etc.). */
const PERMANENT_SEND_ERRORS = new Set(['not_on_whatsapp']);

type SendPayload = JobPayload<typeof SendWhatsAppText>;

/** Comandos vindos do sistema (API/worker) para o conector. */
@Processor(WHATSAPP_CONNECTOR_QUEUE, { concurrency: 10 })
export class ConnectorCommandsProcessor extends TenantAwareProcessor {
  constructor(
    private readonly sessions: SessionManager,
    private readonly reporter: ConnectorReporter,
  ) {
    super();
    this.on(StartWhatsAppSession, ({ channelId, tenantId }) =>
      this.sessions.start(channelId, tenantId),
    );
    this.on(StopWhatsAppSession, ({ channelId, logout }) => this.sessions.stop(channelId, logout));
    this.on(PurgeWhatsAppSession, ({ channelId }) => this.sessions.purge(channelId));
    this.on(SendWhatsAppText, (payload) => this.send(payload));
  }

  private async send(payload: SendPayload): Promise<void> {
    const session = this.sessions.connectedSession(payload.channelId);
    // Sem sessão conectada aqui: ou outra instância é a dona, ou o número está
    // reconectando. Em ambos os casos, falhar faz o job voltar para a fila.
    if (!session) throw new SessionOwnedElsewhereError(payload.channelId);

    try {
      const externalId = await session.sendText(payload.to, payload.text);
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
    if (job.name !== SendWhatsAppText.name) return;
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const payload = job.data.payload as SendPayload;
    await this.reporter.sendResult(payload, {
      messageId: payload.messageId,
      externalId: null,
      error: error instanceof SessionOwnedElsewhereError ? 'not_connected' : error.message,
    });
  }
}
