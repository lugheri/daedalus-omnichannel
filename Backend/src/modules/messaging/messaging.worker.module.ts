import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MESSAGING_QUEUE } from './application/messaging-jobs';
import { MessagingProcessor, MessagingScheduler } from './infra/messaging.processor';
import { MessagingModule } from './messaging.module';

/**
 * Parte do messaging que só roda no worker: o consumidor da fila e a
 * varredura das campanhas. A fila é registrada aqui também — o agendador a
 * injeta, e o registro do MessagingModule não é visível fora dele.
 */
@Module({
  imports: [MessagingModule, BullModule.registerQueue({ name: MESSAGING_QUEUE })],
  providers: [MessagingProcessor, MessagingScheduler],
})
export class MessagingWorkerModule {}
