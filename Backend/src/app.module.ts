import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { ContactsModule } from './modules/contacts';
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
    ContactsModule,
  ],
})
export class AppModule {}
