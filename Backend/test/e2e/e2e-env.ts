import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * Ambiente dos testes e2e: mesmo Postgres e Redis do Docker de
 * desenvolvimento, mas ISOLADOS do `npm run dev` — banco `<nome>_e2e`, Redis
 * no db 1 e filas com prefixo próprio. Assim um worker de dev rodando não
 * pega eventos do teste (nem o teste suja os dados de dev).
 */
export function e2eEnv(): Record<string, string> {
  const base = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};
  const env = { ...process.env, ...base } as Record<string, string>;

  const database = new URL(env.DATABASE_URL);
  database.pathname = `${database.pathname.replace(/_e2e$/, '')}_e2e`;
  const redis = new URL(env.REDIS_URL);
  redis.pathname = '/1';

  return {
    ...env,
    DATABASE_URL: database.toString(),
    REDIS_URL: redis.toString(),
    QUEUE_PREFIX: 'omni-e2e',
    LOG_LEVEL: 'warn',
  };
}
