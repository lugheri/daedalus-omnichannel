/**
 * API pública do módulo teams. Outros módulos só podem importar daqui.
 */
export { TeamsFacade, type TeamSummary } from './application/teams.facade';
export { TeamDeletedEvent } from './domain/events/team-deleted.event';
export { TeamsModule } from './teams.module';
