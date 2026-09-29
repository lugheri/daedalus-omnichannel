import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { KANBAN_AUTOMATIONS_QUEUE } from './application/automations/idle-automations';
import {
  KanbanAutomationsProcessor,
  KanbanAutomationsScheduler,
} from './infra/kanban-automations.processor';
import { KanbanModule } from './kanban.module';

/**
 * Parte do kanban que só roda no worker: a fila das automações de tempo
 * parado, o processor e o agendamento da varredura a cada minuto.
 */
@Module({
  imports: [KanbanModule, BullModule.registerQueue({ name: KANBAN_AUTOMATIONS_QUEUE })],
  providers: [KanbanAutomationsProcessor, KanbanAutomationsScheduler],
})
export class KanbanWorkerModule {}
