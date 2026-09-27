import { defineConfig, devices } from '@playwright/test'

/**
 * Testes end-to-end: navegador real contra o front (Vite) e a API rodando.
 * Suba antes: API (`npm run start:dev` no Backend) e front (`npm run dev`).
 * Outro endereço: E2E_BASE_URL=http://localhost:5180 npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5180',
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
