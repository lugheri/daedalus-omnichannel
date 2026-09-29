import { Module } from '@nestjs/common';
import { MessagingProcessor } from './infra/messaging.processor';
import { MessagingModule } from './messaging.module';

/** Parte do messaging que só roda no worker: o consumidor da fila. */
@Module({
  imports: [MessagingModule],
  providers: [MessagingProcessor],
})
export class MessagingWorkerModule {}
