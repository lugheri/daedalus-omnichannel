/**
 * API pública do módulo kanban. Outros módulos só podem importar daqui.
 */
export { BOARD_CHANGED } from './application/event-handlers/kanban-realtime.handler';
export {
  BoardChangedEvent,
  DealChangedEvent,
  DealClosedEvent,
  DealEnteredColumnEvent,
} from './domain/events/kanban-events';
export { KanbanModule } from './kanban.module';
export { KanbanWorkerModule } from './kanban.worker.module';
