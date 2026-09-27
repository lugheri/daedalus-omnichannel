import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { e2eEnv } from './e2e-env';

/**
 * Uma vez antes de toda a suíte: cria o banco de e2e (se não existir) e
 * aplica as migrations nele. Sem isso, um schema novo só existiria no banco
 * de desenvolvimento.
 */
export default async function globalSetup(): Promise<void> {
  const env = e2eEnv();
  const target = new URL(env.DATABASE_URL);
  const name = target.pathname.slice(1);

  // Conecta no banco "postgres" (sempre existe) para poder criar o de e2e.
  const admin = new URL(env.DATABASE_URL);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) await client.query(`CREATE DATABASE "${name.replaceAll('"', '')}"`);
  } finally {
    await client.end();
  }

  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...env, DATABASE_URL: target.toString() },
    stdio: 'pipe',
  });
}
