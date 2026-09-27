import { Processor } from '@nestjs/bullmq';
import {
  WHATSAPP_EVENTS_QUEUE,
  WhatsAppConnectionChanged,
  WhatsAppMessageReceived,
  WhatsAppMessageSendResult,
} from '../../../contracts/whatsapp-connector.contract';
import { TenantAwareProcessor } from '../../../shared/infra/queue/tenant-aware.processor';
import {
  ApplyConnectionReportUseCase,
  RecordInboundMessageUseCase,
  RecordSendResultUseCase,
} from '../application/use-cases/connector-reports.use-case';

/** Consome os relatos do conector (worker), no tenant de cada relato. */
@Processor(WHATSAPP_EVENTS_QUEUE, { concurrency: 20 })
export class WhatsAppEventsProcessor extends TenantAwareProcessor {
  constructor(
    applyConnectionReport: ApplyConnectionReportUseCase,
    recordInboundMessage: RecordInboundMessageUseCase,
    recordSendResult: RecordSendResultUseCase,
  ) {
    super();
    this.on(WhatsAppConnectionChanged, (report) => applyConnectionReport.execute(report));
    this.on(WhatsAppMessageReceived, (message) => recordInboundMessage.execute(message));
    this.on(WhatsAppMessageSendResult, (result) => recordSendResult.execute(result));
  }
}
