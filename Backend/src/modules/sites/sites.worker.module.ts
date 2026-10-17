import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SITES_QUEUE } from './application/sites-jobs';
import { SitesProcessor } from './infra/sites.processor';
import { SitesModule } from './sites.module';

/** Parte do sites que só roda no worker: o consumidor da fila de publicação. */
@Module({
  imports: [SitesModule, BullModule.registerQueue({ name: SITES_QUEUE })],
  providers: [SitesProcessor],
})
export class SitesWorkerModule {}
