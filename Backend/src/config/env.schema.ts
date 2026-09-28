import { readFileSync } from 'node:fs';
import { z } from 'zod';

/**
 * Convenção `VAR_FILE` (Docker secrets, Kubernetes): em vez do valor, a
 * variável aponta o arquivo que o contém — `JWT_SECRET_FILE=/run/secrets/jwt_secret`.
 * Assim nenhum segredo aparece em `docker inspect` nem no env do processo.
 * Se as duas formas vierem, vale a direta.
 */
export function withSecretFiles(
  raw: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const resolved = { ...raw };
  for (const [name, path] of Object.entries(raw)) {
    if (!name.endsWith('_FILE') || !path) continue;
    const target = name.slice(0, -'_FILE'.length);
    if (resolved[target] !== undefined) continue;
    try {
      resolved[target] = readFileSync(path, 'utf8').trim();
    } catch {
      throw new Error(`${name} aponta para ${path}, que não pôde ser lido`);
    }
  }
  return resolved;
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  // URL do frontend: base dos links enviados por e-mail/compartilhados (ex.: convites).
  APP_URL: z
    .url()
    .default('http://localhost:5180')
    .transform((url) => url.replace(/\/+$/, '')),
  // Origens do frontend autorizadas (CORS e checagem de Origin), separadas por vírgula.
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5180')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),
  // true atrás de um reverse proxy (Traefik), para o IP real vir do X-Forwarded-For.
  // Nunca true com a API exposta direto: o cliente poderia forjar o próprio IP.
  TRUST_PROXY: z.stringbool().default(false),
  // Prefixo das chaves das filas no Redis (testes usam outro, para não disputar jobs).
  QUEUE_PREFIX: z
    .string()
    .regex(/^[\w-]+$/)
    .default('omni'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // O worker não expõe a API; só um servidor mínimo de health check nesta porta.
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  // Porta do health check do processo whatsapp-connector.
  CONNECTOR_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  // Chave de criptografia dos segredos guardados no banco (sessões do WhatsApp,
  // tokens de provedores). 32 bytes em base64. Gere com:
  // node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  // Trocar a chave torna ilegível o que foi cifrado com a anterior.
  ENCRYPTION_KEY: z.base64().refine((v) => Buffer.from(v, 'base64').length === 32, {
    message: 'ENCRYPTION_KEY precisa ser o base64 de 32 bytes',
  }),
  // Segredo de assinatura do access token. Gere com:
  // node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa de pelo menos 32 caracteres'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  // Armazenamento de arquivos (API S3). Produção: S3 (sem S3_ENDPOINT, com a
  // região do bucket). Dev: MinIO (S3_ENDPOINT + S3_FORCE_PATH_STYLE=true).
  // O bucket é PRIVADO: arquivos só saem pela API, que confere o acesso.
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  // Tamanho máximo de mídia (recebida ou enviada), em MB.
  MEDIA_MAX_MB: z.coerce.number().int().min(1).max(100).default(25),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(withSecretFiles(raw));
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
