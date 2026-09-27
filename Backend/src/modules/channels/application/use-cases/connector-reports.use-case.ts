import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  WhatsAppConnectionChanged,
  WhatsAppMessageReceived,
  WhatsAppMessageSendResult,
} from '../../../../contracts/whatsapp-connector.contract';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import type { JobPayload } from '../../../../shared/application/job-queue';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import {
  ChannelMessageReceivedEvent,
  ChannelMessageSendResultEvent,
} from '../../domain/events/channel-events';
import { CHANNEL_REPOSITORY, type ChannelRepository } from '../ports/channel.repository';

/**
 * Traduzem o que o conector relata (fila `whatsapp-events`) para o domínio:
 * estado do canal e eventos públicos que outros módulos consomem.
 * Rodam no worker, no tenant do relato.
 */

@Injectable()
export class ApplyConnectionReportUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(report: JobPayload<typeof WhatsAppConnectionChanged>): Promise<void> {
    await this.unitOfWork.run(async () => {
      const channel = await this.channels.findById(report.channelId);
      if (!channel) return; // canal excluído: relato atrasado, nada a fazer

      const changed = channel.applyConnectionStatus({
        status: report.status,
        phoneNumber: report.phoneNumber,
        reason: report.reason,
        at: new Date(report.at),
      });
      if (!changed) return;

      await this.channels.save(channel);
      await this.events.publish(channel.pullEvents());
    });
  }
}

@Injectable()
export class RecordInboundMessageUseCase {
  private readonly logger = new Logger(RecordInboundMessageUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(message: JobPayload<typeof WhatsAppMessageReceived>): Promise<void> {
    await this.unitOfWork.run(async () => {
      const channel = await this.channels.findById(message.channelId);
      if (!channel) return;

      this.logger.log(
        `Mensagem ${message.fromMe ? 'enviada pelo celular para' : 'recebida de'} ` +
          `${message.contactPhone ?? message.contactJid} (${message.kind}) no canal ${channel.name}`,
      );
      await this.events.publish([
        new ChannelMessageReceivedEvent(channel.id, channel.tenantId, {
          externalId: message.externalId,
          contactPhone: message.contactPhone,
          contactHandle: message.contactJid,
          contactName: message.contactName,
          fromMe: message.fromMe,
          kind: message.kind,
          text: message.text,
          sentAt: message.sentAt,
        }),
      ]);
    });
  }
}

@Injectable()
export class RecordSendResultUseCase {
  private readonly logger = new Logger(RecordSendResultUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(result: JobPayload<typeof WhatsAppMessageSendResult>): Promise<void> {
    await this.unitOfWork.run(async () => {
      const channel = await this.channels.findById(result.channelId);
      if (!channel) return;

      if (result.status === 'failed') {
        this.logger.warn(`Falha ao enviar a mensagem ${result.messageId}: ${result.error}`);
      }
      await this.events.publish([
        new ChannelMessageSendResultEvent(channel.id, channel.tenantId, {
          messageId: result.messageId,
          status: result.status,
          externalId: result.externalId,
          error: result.error,
        }),
      ]);
    });
  }
}
