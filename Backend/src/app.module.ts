import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { AccountsModule } from './modules/accounts';
import { ChannelsModule } from './modules/channels';
import { ContactsModule } from './modules/contacts';
import { ConversationsModule } from './modules/conversations';
import { IdentityModule } from './modules/identity';
import { TeamsModule } from './modules/teams';
import { RealtimeModule } from './modules/realtime';
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
    ChannelsModule,
    RealtimeModule,
  ],
})
export class AppModule {}
