import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { WorkerHealthServer } from './health/worker-health.server';
import { AccountsModule } from './modules/accounts';
import { ChannelsWorkerModule } from './modules/channels';
import { ContactsModule } from './modules/contacts';
import { ConversationsModule } from './modules/conversations';
import { IdentityModule } from './modules/identity';
import { KanbanWorkerModule } from './modules/kanban';
import { TeamsModule } from './modules/teams';
import { OutboxWorkerModule } from './shared/infra/events/outbox-worker.module';
import { PrismaModule } from './shared/infra/prisma/prisma.module';
import { SharedInfraModule } from './shared/infra/shared-infra.module';

/**
 * Processo `worker`: consome filas e entrega eventos de domínio. Sobe como
 * application context (sem HTTP) — os controllers dos módulos ficam inertes.
 *
 * Importa os mesmos módulos de negócio da API (os consumidores de eventos
 * vivem neles) e, de cada módulo com filas, o `<modulo>.worker.module.ts`,
 * que registra os processors.
 */
@Module({
  imports: [
    // Infraestrutura
    AppConfigModule,
    PrismaModule,
    SharedInfraModule,
    HealthModule,
    OutboxWorkerModule,
    // Módulos de negócio
    IdentityModule,
    AccountsModule,
    ContactsModule,
    TeamsModule,
    ConversationsModule,
    KanbanWorkerModule,
    // Processors por módulo (<modulo>.worker.module.ts)
    ChannelsWorkerModule,
  ],
  providers: [WorkerHealthServer],
})
export class WorkerModule {}
