import { z } from 'zod';

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
  // Segredo de assinatura do access token. Gere com:
  // node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa de pelo menos 32 caracteres'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
