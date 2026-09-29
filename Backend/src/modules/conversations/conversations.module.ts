import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { ChannelsModule } from '../channels';
import { ContactsModule } from '../contacts';
import { TeamsModule } from '../teams';
import { ChannelMessagesHandler } from './application/event-handlers/channel-messages.handler';
import { NotifyRealtimeHandler } from './application/event-handlers/notify-realtime.handler';
import { CHANNEL_GATEWAY } from './application/ports/channel-gateway';
import { CONTACT_DIRECTORY } from './application/ports/contact-directory';
import { CONVERSATION_REPOSITORY } from './application/ports/conversation.repository';
import { MEMBER_ACCESS } from './application/ports/member-access';
import { MESSAGE_REPOSITORY } from './application/ports/message.repository';
import { TEAM_DIRECTORY } from './application/ports/team-directory';
import {
  ClaimConversationUseCase,
  TransferConversationUseCase,
} from './application/use-cases/assign-conversation/assign-conversation.use-cases';
import { ConversationsTeamCleanupHandler } from './application/event-handlers/conversations-team-cleanup.handler';
import { ApplySendResultUseCase } from './application/use-cases/apply-send-result/apply-send-result.use-case';
import { GetConversationUseCase } from './application/use-cases/get-conversation/get-conversation.use-case';
import { ListConversationsUseCase } from './application/use-cases/list-conversations/list-conversations.use-case';
import { ListMessagesUseCase } from './application/use-cases/list-messages/list-messages.use-case';
import { RecordChannelMessageUseCase } from './application/use-cases/record-channel-message/record-channel-message.use-case';
import { SendMessageUseCase } from './application/use-cases/send-message/send-message.use-case';
import {
  ChangeConversationStatusUseCase,
  MarkConversationReadUseCase,
} from './application/use-cases/update-conversation/update-conversation.use-cases';
import { VisibleConversations } from './application/visible-conversations';
import { ConversationsFacade } from './application/conversations.facade';
import { TextDelivery } from './application/text-delivery';
import {
  AssignBySystemUseCase,
  SendAutomatedMessageUseCase,
} from './application/use-cases/system-actions/system-actions.use-cases';
import { ConversationTabulator } from './application/conversation-tabulator';
import { CONVERSATION_DISPOSITION_REPOSITORY } from './application/ports/conversation-disposition.repository';
import { DISPOSITION_REPOSITORY } from './application/ports/disposition.repository';
import {
  CreateDispositionUseCase,
  DeleteDispositionUseCase,
  ListDispositionsUseCase,
  UpdateDispositionUseCase,
} from './application/use-cases/dispositions/dispositions.use-cases';
import {
  ListConversationDispositionsUseCase,
  TabulateConversationUseCase,
} from './application/use-cases/tabulate-conversation/tabulate-conversation.use-cases';
import { DispositionsController } from './http/dispositions.controller';
import {
  PrismaConversationDispositionRepository,
  PrismaDispositionRepository,
} from './infra/prisma-disposition.repository';
import { GetMessageMediaUseCase } from './application/use-cases/get-message-media/get-message-media.use-case';
import { SendAttachmentUseCase } from './application/use-cases/send-attachment/send-attachment.use-case';
import { ConversationsController } from './http/conversations.controller';
import {
  ChannelsFacadeGateway,
  ContactsFacadeDirectory,
  FacadesMemberAccess,
  TeamsFacadeDirectory,
} from './infra/facade-gateways';
import { PrismaConversationRepository } from './infra/prisma-conversation.repository';
import { PrismaMessageRepository } from './infra/prisma-message.repository';

/**
 * Conversas e mensagens. Recebe o que acontece nos canais por eventos
 * (ChannelMessagesHandler, no worker) e fala com contacts, channels e
 * accounts só pelas facades, atrás dos próprios ports.
 */
@Module({
  imports: [AccountsModule, ChannelsModule, ContactsModule, TeamsModule],
  controllers: [ConversationsController, DispositionsController],
  providers: [
    VisibleConversations,
    ConversationsFacade,
    TextDelivery,
    // Sistema (automações, pela facade)
    SendAutomatedMessageUseCase,
    AssignBySystemUseCase,
    ConversationTabulator,
    // Membro (HTTP)
    ListConversationsUseCase,
    GetConversationUseCase,
    ListMessagesUseCase,
    SendMessageUseCase,
    ChangeConversationStatusUseCase,
    MarkConversationReadUseCase,
    ClaimConversationUseCase,
    TransferConversationUseCase,
    SendAttachmentUseCase,
    GetMessageMediaUseCase,
    TabulateConversationUseCase,
    ListConversationDispositionsUseCase,
    // Tabulações (catálogo)
    ListDispositionsUseCase,
    CreateDispositionUseCase,
    UpdateDispositionUseCase,
    DeleteDispositionUseCase,
    // Canais (worker)
    RecordChannelMessageUseCase,
    ApplySendResultUseCase,
    ChannelMessagesHandler,
    NotifyRealtimeHandler,
    ConversationsTeamCleanupHandler,
    // Adapters
    { provide: CONVERSATION_REPOSITORY, useClass: PrismaConversationRepository },
    { provide: MESSAGE_REPOSITORY, useClass: PrismaMessageRepository },
    { provide: DISPOSITION_REPOSITORY, useClass: PrismaDispositionRepository },
    {
      provide: CONVERSATION_DISPOSITION_REPOSITORY,
      useClass: PrismaConversationDispositionRepository,
    },
    { provide: CONTACT_DIRECTORY, useClass: ContactsFacadeDirectory },
    { provide: CHANNEL_GATEWAY, useClass: ChannelsFacadeGateway },
    { provide: MEMBER_ACCESS, useClass: FacadesMemberAccess },
    { provide: TEAM_DIRECTORY, useClass: TeamsFacadeDirectory },
  ],
  exports: [ConversationsFacade],
})
export class ConversationsModule {}
