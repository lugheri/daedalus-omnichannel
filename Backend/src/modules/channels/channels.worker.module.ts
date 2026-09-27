import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WHATSAPP_EVENTS_QUEUE } from '../../contracts/whatsapp-connector.contract';
import { ChannelsModule } from './channels.module';
import { WhatsAppEventsProcessor } from './infra/whatsapp-events.processor';

/** Só no processo worker: consome os relatos do conector do WhatsApp. */
@Module({
  imports: [ChannelsModule, BullModule.registerQueue({ name: WHATSAPP_EVENTS_QUEUE })],
  providers: [WhatsAppEventsProcessor],
})
export class ChannelsWorkerModule {}
