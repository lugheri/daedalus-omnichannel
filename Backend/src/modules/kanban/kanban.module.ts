import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { ContactsModule } from '../contacts';
import { ConversationsModule } from '../conversations';
import { TeamsModule } from '../teams';
import {
  DealEntry,
  KanbanConversationEntryHandler,
  KanbanDefaultBoardHandler,
  KanbanLeadEntryHandler,
} from './application/event-handlers/kanban-auto-add.handler';
import { KanbanRealtimeHandler } from './application/event-handlers/kanban-realtime.handler';
import { KanbanTeamCleanupHandler } from './application/event-handlers/kanban-team-cleanup.handler';
import { BOARD_REPOSITORY } from './application/ports/board.repository';
import { CONTACT_DIRECTORY } from './application/ports/contact-directory';
import { CONVERSATION_DIRECTORY } from './application/ports/conversation-directory';
import { DEAL_ACCESS } from './application/ports/deal-access';
import { DEAL_REPOSITORY } from './application/ports/deal.repository';
import { TEAM_DIRECTORY } from './application/ports/team-directory';
import {
  AddColumnUseCase,
  BoardsReader,
  CreateBoardUseCase,
  CreateDefaultBoardUseCase,
  DeleteBoardUseCase,
  DeleteColumnUseCase,
  UpdateBoardUseCase,
  UpdateColumnUseCase,
} from './application/use-cases/boards.use-cases';
import {
  CreateDealUseCase,
  DealVisibility,
  DeleteDealUseCase,
  GetDealUseCase,
  ListBoardDealsUseCase,
  ListContactDealsUseCase,
  ListConversationDealsUseCase,
  MoveDealUseCase,
  SetDealStatusUseCase,
  UpdateDealUseCase,
} from './application/use-cases/deals.use-cases';
import { BoardsController } from './http/boards.controller';
import { DealsController } from './http/deals.controller';
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
  AccountsDealAccess,
  AccountsFacadeMembers,
  ContactsFacadeContacts,
  ConversationsFacadeActions,
  ConversationsFacadeDirectory,
  TeamsFacadeDirectory,
} from './infra/facade-gateways';
import { PrismaBoardRepository } from './infra/prisma-board.repository';
import { PrismaDealRepository } from './infra/prisma-deal.repository';

/**
 * Funis de vendas: o card é um negócio de um contato, com a conversa
 * opcional. Lê contatos e conversas pelas facades (conversas sempre no escopo
 * do membro) e reage a conversas novas e leads do site (entrada automática),
 * a contas novas (funil padrão) e a equipes excluídas.
 */
@Module({
  imports: [AccountsModule, ContactsModule, ConversationsModule, TeamsModule],
  controllers: [BoardsController, DealsController, AutomationsController],
  providers: [
    BoardsReader,
    CreateBoardUseCase,
    CreateDefaultBoardUseCase,
    UpdateBoardUseCase,
    DeleteBoardUseCase,
    AddColumnUseCase,
    UpdateColumnUseCase,
    DeleteColumnUseCase,
    DealVisibility,
    ListBoardDealsUseCase,
    CreateDealUseCase,
    GetDealUseCase,
    UpdateDealUseCase,
    MoveDealUseCase,
    SetDealStatusUseCase,
    DeleteDealUseCase,
    ListContactDealsUseCase,
    ListConversationDealsUseCase,
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
    DealEntry,
    KanbanConversationEntryHandler,
    KanbanLeadEntryHandler,
    KanbanDefaultBoardHandler,
    KanbanTeamCleanupHandler,
    KanbanRealtimeHandler,
    // Adapters
    { provide: BOARD_REPOSITORY, useClass: PrismaBoardRepository },
    { provide: DEAL_REPOSITORY, useClass: PrismaDealRepository },
    { provide: CONTACT_DIRECTORY, useClass: ContactsFacadeContacts },
    { provide: DEAL_ACCESS, useClass: AccountsDealAccess },
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
