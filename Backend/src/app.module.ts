import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { AccountsModule } from './modules/accounts';
import { CatalogModule } from './modules/catalog';
import { ChannelsModule } from './modules/channels';
import { UsageModule } from './modules/usage';
import { ContactsModule } from './modules/contacts';
import { ConversationsModule } from './modules/conversations';
import { FormsModule } from './modules/forms';
import { IdentityModule } from './modules/identity';
import { KanbanModule } from './modules/kanban';
import { MessagingModule } from './modules/messaging';
import { TeamsModule } from './modules/teams';
import { RealtimeModule } from './modules/realtime';
import { SchedulingModule } from './modules/scheduling';
import { SitesModule } from './modules/sites';
import { WebChatModule } from './modules/webchat';
import { SharedHttpModule } from './shared/http/shared-http.module';
import { PrismaModule } from './shared/infra/prisma/prisma.module';
import { SharedInfraModule } from './shared/infra/shared-infra.module';

@Module({
  imports: [
    // Infraestrutura (global)
    AppConfigModule,
    PrismaModule,
    SharedInfraModule,
    SharedHttpModule,
    HealthModule,
    // Módulos de negócio
    IdentityModule,
    AccountsModule,
    ContactsModule,
    TeamsModule,
    ConversationsModule,
    KanbanModule,
    MessagingModule,
    CatalogModule,
    FormsModule,
    SchedulingModule,
    UsageModule,
    SitesModule,
    WebChatModule,
    ChannelsModule,
    RealtimeModule,
  ],
})
export class AppModule {}
