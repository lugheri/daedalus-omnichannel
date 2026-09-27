import { z } from 'zod'

/**
 * Variáveis de ambiente do front (precisam do prefixo VITE_ e são embutidas no
 * build — nunca coloque segredos aqui). Validadas no carregamento, como no backend.
 */
const envSchema = z.object({
  VITE_API_URL: z
    .url()
    .default('http://localhost:3000')
    .transform((url) => url.replace(/\/+$/, '')),
})

export const env = envSchema.parse(import.meta.env)
