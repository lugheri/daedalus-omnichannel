import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { ConversationsModule } from '../conversations';
import { TeamsModule } from '../teams';
import { KanbanAutoAddHandler } from './application/event-handlers/kanban-auto-add.handler';
import { KanbanRealtimeHandler } from './application/event-handlers/kanban-realtime.handler';
import { KanbanTeamCleanupHandler } from './application/event-handlers/kanban-team-cleanup.handler';
import { BOARD_CARD_REPOSITORY } from './application/ports/board-card.repository';
import { BOARD_REPOSITORY } from './application/ports/board.repository';
import { CONVERSATION_DIRECTORY } from './application/ports/conversation-directory';
import { TEAM_DIRECTORY } from './application/ports/team-directory';
import {
  AddColumnUseCase,
  BoardsReader,
  CreateBoardUseCase,
  DeleteBoardUseCase,
  DeleteColumnUseCase,
  UpdateBoardUseCase,
  UpdateColumnUseCase,
} from './application/use-cases/boards.use-cases';
import {
  AddCardUseCase,
  ListBoardCardsUseCase,
  ListConversationPlacementsUseCase,
  MoveCardUseCase,
  RemoveCardUseCase,
} from './application/use-cases/cards.use-cases';
import { BoardsController } from './http/boards.controller';
import { AutomationsController } from './http/automations.controller';
import { AutomationRunner } from './application/automations/automation-runner';
import {
  AutomationReferences,
  CreateAutomationUseCase,
  DeleteAutomationUseCase,
  ListAutomationRunsUseCase,
  ListAutomationsUseCase,
  UpdateAutomationUseCase,
} from './application/automations/automation-rules.use-cases';
import { KanbanAutomationTriggersHandler } from './application/automations/automation-triggers.handler';
import { IdleSweepUseCase, RunIdleRuleUseCase } from './application/automations/idle-automations';
import { AUTOMATION_RULE_REPOSITORY } from './application/ports/automation-rule.repository';
import { AUTOMATION_RUN_REPOSITORY } from './application/ports/automation-run.repository';
import { CONVERSATION_ACTIONS } from './application/ports/conversation-actions';
import { MEMBER_DIRECTORY } from './application/ports/member-directory';
import {
  PrismaAutomationRuleRepository,
  PrismaAutomationRunRepository,
} from './infra/prisma-automation.repository';
import {
  AccountsFacadeMembers,
  ConversationsFacadeActions,
  ConversationsFacadeDirectory,
  TeamsFacadeDirectory,
} from './infra/facade-gateways';
import { PrismaBoardCardRepository } from './infra/prisma-board-card.repository';
import { PrismaBoardRepository } from './infra/prisma-board.repository';

/**
 * Quadros kanban: o card é uma conversa (atendimento). Lê as conversas pela
 * facade do conversations (sempre no escopo do membro) e reage a conversas
 * novas (entrada automática) e a equipes excluídas.
 */
@Module({
  imports: [AccountsModule, ConversationsModule, TeamsModule],
  controllers: [BoardsController, AutomationsController],
  providers: [
    BoardsReader,
    CreateBoardUseCase,
    UpdateBoardUseCase,
    DeleteBoardUseCase,
    AddColumnUseCase,
    UpdateColumnUseCase,
    DeleteColumnUseCase,
    ListBoardCardsUseCase,
    AddCardUseCase,
    MoveCardUseCase,
    RemoveCardUseCase,
    ListConversationPlacementsUseCase,
    // Automações
    AutomationReferences,
    ListAutomationsUseCase,
    CreateAutomationUseCase,
    UpdateAutomationUseCase,
    DeleteAutomationUseCase,
    ListAutomationRunsUseCase,
    AutomationRunner,
    IdleSweepUseCase,
    RunIdleRuleUseCase,
    KanbanAutomationTriggersHandler,
    // Worker
    KanbanAutoAddHandler,
    KanbanTeamCleanupHandler,
    KanbanRealtimeHandler,
    // Adapters
    { provide: BOARD_REPOSITORY, useClass: PrismaBoardRepository },
    { provide: BOARD_CARD_REPOSITORY, useClass: PrismaBoardCardRepository },
    { provide: CONVERSATION_DIRECTORY, useClass: ConversationsFacadeDirectory },
    { provide: TEAM_DIRECTORY, useClass: TeamsFacadeDirectory },
    { provide: AUTOMATION_RULE_REPOSITORY, useClass: PrismaAutomationRuleRepository },
    { provide: AUTOMATION_RUN_REPOSITORY, useClass: PrismaAutomationRunRepository },
    { provide: CONVERSATION_ACTIONS, useClass: ConversationsFacadeActions },
    { provide: MEMBER_DIRECTORY, useClass: AccountsFacadeMembers },
  ],
  exports: [IdleSweepUseCase, RunIdleRuleUseCase],
})
export class KanbanModule {}
