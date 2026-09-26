import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Global, Module } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { AppConfig } from '../../config/app-config';
import { EVENT_BUS } from '../application/event-bus';
import { ID_GENERATOR } from '../application/id-generator';
import { TENANT_CONTEXT } from '../application/tenant-context';
import { UNIT_OF_WORK } from '../application/unit-of-work';
import { ClsTenantContext } from './context/cls-tenant-context';
import { applyDevTenantHeader } from './context/dev-tenant-header';
import { InMemoryEventBus } from './events/in-memory-event-bus';
import { UuidV7IdGenerator } from './id/uuid-v7.id-generator';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaUnitOfWork } from './prisma/prisma-unit-of-work';

/**
 * Infraestrutura transversal, disponível para todos os módulos:
 * contexto por requisição (CLS), transações, event bus e gerador de IDs.
 * Aqui cada port do shared kernel é ligado ao seu adapter.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
    ClsModule.forRootAsync({
      global: true,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        middleware: {
          mount: true,
          setup: (cls, req: IncomingMessage) => applyDevTenantHeader(cls, req, config.isProduction),
        },
      }),
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma({ prismaInjectionToken: PrismaService }),
        }),
      ],
    }),
  ],
  providers: [
    { provide: ID_GENERATOR, useClass: UuidV7IdGenerator },
    { provide: EVENT_BUS, useClass: InMemoryEventBus },
    { provide: TENANT_CONTEXT, useClass: ClsTenantContext },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
  ],
  exports: [ID_GENERATOR, EVENT_BUS, TENANT_CONTEXT, UNIT_OF_WORK],
})
export class SharedInfraModule {}
