import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { ClsModule } from 'nestjs-cls';
import type { IncomingMessage } from 'node:http';
import { AppConfig } from '../../config/app-config';
import { ACTOR_CONTEXT } from '../application/actor-context';
import { EVENT_BUS } from '../application/event-bus';
import { FILE_STORAGE } from '../application/file-storage';
import { ID_GENERATOR } from '../application/id-generator';
import { JOB_QUEUE } from '../application/job-queue';
import { REALTIME_NOTIFIER } from '../application/realtime';
import { TENANT_CONTEXT } from '../application/tenant-context';
import { UNIT_OF_WORK } from '../application/unit-of-work';
import { ClsActorContext } from './context/cls-actor-context';
import { ClsTenantContext } from './context/cls-tenant-context';
import { requestIdFor } from './context/request-id';
import { OutboxEventBus } from './events/outbox-event-bus';
import { UuidV7IdGenerator } from './id/uuid-v7.id-generator';
import { AppLoggerModule } from './logger/logger.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaUnitOfWork } from './prisma/prisma-unit-of-work';
import { bullConnectionFrom } from './queue/bull-connection';
import { BullJobQueue } from './queue/bull-job-queue';
import { RedisRealtimeNotifier } from './realtime/redis-realtime.notifier';
import { S3FileStorage } from './storage/s3-file-storage';
import { AppThrottlerGuard } from './rate-limit/app-throttler.guard';
import { RedisThrottlerStorage } from './rate-limit/redis-throttler.storage';
import { REDIS_CLIENT, RedisModule } from './redis/redis.module';

/**
 * Infraestrutura transversal, disponível para todos os módulos e processos
 * (api e worker): contexto por operação (CLS), logs, transações, filas,
 * eventos (outbox), gerador de IDs e rate limit. Aqui cada port do shared
 * kernel é ligado ao seu adapter.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        // O id do contexto é o correlation id: vai nos logs, nos jobs e volta
        // no header X-Request-Id da resposta (ver request-id.ts).
        idGenerator: (req: IncomingMessage) => requestIdFor(req),
      },
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma({ prismaInjectionToken: PrismaService }),
        }),
      ],
    }),
    AppLoggerModule,
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        connection: bullConnectionFrom(config.redisUrl),
        prefix: config.queuePrefix,
      }),
    }),
    // Limite padrão por IP para toda a API; rotas sensíveis (login, cadastro)
    // apertam com @Throttle. Contadores no Redis, compartilhados entre réplicas.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
  ],
  providers: [
    { provide: ID_GENERATOR, useClass: UuidV7IdGenerator },
    { provide: EVENT_BUS, useClass: OutboxEventBus },
    { provide: JOB_QUEUE, useClass: BullJobQueue },
    { provide: ACTOR_CONTEXT, useClass: ClsActorContext },
    { provide: TENANT_CONTEXT, useClass: ClsTenantContext },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: REALTIME_NOTIFIER, useClass: RedisRealtimeNotifier },
    { provide: FILE_STORAGE, useClass: S3FileStorage },
    // Registrado antes do guard de autenticação: rejeita excesso de
    // requisições sem gastar verificação de token.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
  exports: [
    ID_GENERATOR,
    EVENT_BUS,
    JOB_QUEUE,
    ACTOR_CONTEXT,
    TENANT_CONTEXT,
    UNIT_OF_WORK,
    REALTIME_NOTIFIER,
    FILE_STORAGE,
  ],
})
export class SharedInfraModule {}
