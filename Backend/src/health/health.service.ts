import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../shared/infra/prisma/prisma.service';
import { REDIS_CLIENT } from '../shared/infra/redis/redis.module';

const CHECK_TIMEOUT_MS = 1_000;

export interface Readiness {
  ready: boolean;
  checks: { database: 'up' | 'down'; redis: 'up' | 'down' };
}

/** Dependências de que todo processo (api e worker) precisa para atender. */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async readiness(): Promise<Readiness> {
    const [database, redis] = await Promise.all([
      check(() => this.prisma.$queryRaw`SELECT 1`),
      check(() => this.redis.ping()),
    ]);
    return { ready: database === 'up' && redis === 'up', checks: { database, redis } };
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
