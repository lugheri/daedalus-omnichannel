import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { ClsModule } from 'nestjs-cls';
import { ACTOR_CONTEXT } from '../application/actor-context';
import { EVENT_BUS } from '../application/event-bus';
import { ID_GENERATOR } from '../application/id-generator';
import { TENANT_CONTEXT } from '../application/tenant-context';
import { UNIT_OF_WORK } from '../application/unit-of-work';
import { ClsActorContext } from './context/cls-actor-context';
import { ClsTenantContext } from './context/cls-tenant-context';
import { InMemoryEventBus } from './events/in-memory-event-bus';
import { UuidV7IdGenerator } from './id/uuid-v7.id-generator';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaUnitOfWork } from './prisma/prisma-unit-of-work';
import { RedisThrottlerStorage } from './rate-limit/redis-throttler.storage';
import { REDIS_CLIENT, RedisModule } from './redis/redis.module';

/**
 * Infraestrutura transversal, disponível para todos os módulos:
 * contexto por requisição (CLS), transações, event bus, gerador de IDs e
 * rate limit. Aqui cada port do shared kernel é ligado ao seu adapter.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    EventEmitterModule.forRoot(),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma({ prismaInjectionToken: PrismaService }),
        }),
      ],
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
    { provide: EVENT_BUS, useClass: InMemoryEventBus },
    { provide: ACTOR_CONTEXT, useClass: ClsActorContext },
    { provide: TENANT_CONTEXT, useClass: ClsTenantContext },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    // Registrado antes do guard de autenticação: rejeita excesso de
    // requisições sem gastar verificação de token.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [ID_GENERATOR, EVENT_BUS, ACTOR_CONTEXT, TENANT_CONTEXT, UNIT_OF_WORK],
})
export class SharedInfraModule {}
