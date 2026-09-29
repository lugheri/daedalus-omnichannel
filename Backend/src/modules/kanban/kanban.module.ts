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
import { ConversationsFacadeDirectory, TeamsFacadeDirectory } from './infra/facade-gateways';
import { PrismaBoardCardRepository } from './infra/prisma-board-card.repository';
import { PrismaBoardRepository } from './infra/prisma-board.repository';

/**
 * Quadros kanban: o card é uma conversa (atendimento). Lê as conversas pela
 * facade do conversations (sempre no escopo do membro) e reage a conversas
 * novas (entrada automática) e a equipes excluídas.
 */
@Module({
  imports: [AccountsModule, ConversationsModule, TeamsModule],
  controllers: [BoardsController],
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
    // Worker
    KanbanAutoAddHandler,
    KanbanTeamCleanupHandler,
    KanbanRealtimeHandler,
    // Adapters
    { provide: BOARD_REPOSITORY, useClass: PrismaBoardRepository },
    { provide: BOARD_CARD_REPOSITORY, useClass: PrismaBoardCardRepository },
    { provide: CONVERSATION_DIRECTORY, useClass: ConversationsFacadeDirectory },
    { provide: TEAM_DIRECTORY, useClass: TeamsFacadeDirectory },
  ],
})
export class KanbanModule {}
