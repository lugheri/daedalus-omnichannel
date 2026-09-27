import { e2eEnv } from './e2e-env';

/**
 * Roda em cada arquivo de teste, antes dos imports da aplicação.
 *
 * (`process.loadEnvFile` não serve aqui: o Jest dá a cada teste uma cópia do
 * `process.env`, e aquela função grava no ambiente real, fora do sandbox.)
 */
Object.assign(process.env, e2eEnv());
