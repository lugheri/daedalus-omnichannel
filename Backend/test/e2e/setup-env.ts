import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * Testes e2e usam o Postgres e o Redis de desenvolvimento (Docker), mas com
 * filas num prefixo próprio — não disputam jobs com o `npm run dev` rodando.
 *
 * (`process.loadEnvFile` não serve aqui: o Jest dá a cada teste uma cópia do
 * `process.env`, e aquela função grava no ambiente real, fora do sandbox.)
 */
if (existsSync('.env')) Object.assign(process.env, parseEnv(readFileSync('.env', 'utf8')));
process.env.QUEUE_PREFIX = 'omni-e2e';
process.env.LOG_LEVEL = 'warn';
