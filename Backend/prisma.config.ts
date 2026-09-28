import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile('.env');

/** Em produção a URL vem de um Docker secret (DATABASE_URL_FILE), como na aplicação. */
const databaseUrl =
  process.env.DATABASE_URL ??
  (process.env.DATABASE_URL_FILE
    ? readFileSync(process.env.DATABASE_URL_FILE, 'utf8').trim()
    : undefined);

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: databaseUrl },
});
