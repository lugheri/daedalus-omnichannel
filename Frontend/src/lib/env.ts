import { z } from 'zod'

declare global {
  interface Window {
    /** Configuração de runtime, escrita no /config.js pelo container (ver Dockerfile). */
    __APP_CONFIG__?: { apiUrl?: string }
  }
}

/**
 * Configuração do front. Em produção vem do `/config.js`, gerado quando o
 * container sobe (a mesma imagem serve qualquer ambiente); em dev, das
 * variáveis VITE_* do Vite. Nunca coloque segredos aqui: tudo vai para o
 * navegador.
 */
const envSchema = z.object({
  VITE_API_URL: z
    .url()
    .default('http://localhost:3000')
    .transform((url) => url.replace(/\/+$/, '')),
})

const runtime = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined

export const env = envSchema.parse({
  ...import.meta.env,
  ...(runtime?.apiUrl && { VITE_API_URL: runtime.apiUrl }),
})
