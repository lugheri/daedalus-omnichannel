import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { Public } from '../shared/http/public.decorator';
import { PrismaService } from '../shared/infra/prisma/prisma.service';
import { REDIS_CLIENT } from '../shared/infra/redis/redis.module';

const CHECK_TIMEOUT_MS = 1_000;

/** Sondas do orquestrador: sem autenticação e sem rate limit. */
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const [database, redis] = await Promise.all([
      check(() => this.prisma.$queryRaw`SELECT 1`),
      check(() => this.redis.ping()),
    ]);
    const checks = { database, redis };

    if (database === 'down' || redis === 'down') {
      throw new ServiceUnavailableException({ status: 'error', checks });
    }
    return { status: 'ok', checks };
  }
}

async function check(probe: () => Promise<unknown>): Promise<'up' | 'down'> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS).unref(),
  );
  try {
    await Promise.race([probe(), timeout]);
    return 'up';
  } catch {
    return 'down';
  }
}
