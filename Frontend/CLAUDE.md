# Frontend — React SPA

Painel de atendimento em **React + Vite**, servido como arquivos estáticos. Leia também o [CLAUDE.md da raiz](../CLAUDE.md) e o [ADR 0005](../docs/adr/0005-refresh-token-em-cookie.md).

## Stack

- React 19 + Vite 8 + TypeScript 6 (`strict`)
- **shadcn/ui** (base Radix, estilo `radix-nova`, ícones Lucide) + Tailwind 4 — componentes copiados em `src/components/ui` (adicionar com `npx shadcn@latest add <nome>`; não editar à mão sem motivo)
- React Router 8 (data router, páginas com `lazy`)
- TanStack Query — todo dado vindo da API
- React Hook Form + Zod — formulários
- sonner — toasts
- oxlint (lint) + Prettier (sem ponto e vírgula, aspas simples, 100 colunas)
- Playwright — testes end-to-end

## Comandos

```bash
npm run dev          # http://localhost:5180 (porta fixa do projeto)
npm run build        # typecheck + build de produção
npm run typecheck
npm run lint
npm run format
npm run test:e2e     # exige API (3000) e front (5180) rodando
```

A porta do dev server é **5180**, não a 5173 padrão do Vite: outro projeto da máquina usa a 5173. Ela precisa bater com `CORS_ORIGINS` e `APP_URL` do backend.

## Estrutura

```
src/
├── main.tsx
├── app/                 # router, providers, layouts, navegação (menu)
├── components/
│   ├── ui/              # shadcn (gerado)
│   └── form/            # TextField, FormError — ligam RHF + Field do shadcn
├── lib/
│   ├── env.ts           # VITE_* validadas com Zod
│   └── api/             # client.ts (fetch + sessão), api-error.ts (ApiError + mensagens pt-BR)
└── features/<feature>/  # espelha os módulos do backend: auth, members, roles, contacts...
    ├── api.ts           # chamadas + tipos + hooks de query (useX) + query keys
    └── *-page.tsx, *-dialog.tsx
e2e/                     # testes Playwright
```

## Regras

- **Sessão (ADR 0005):** o access token fica **só em memória** (`lib/api/client.ts`), nunca em `localStorage`/`sessionStorage`. O refresh token está num cookie HttpOnly que o JS não lê. Ao abrir a página, a sessão é restaurada com `POST /v1/auth/refresh`.
- **Tempo real (`features/realtime`):** uma conexão Socket.IO por aba, só WebSocket, com o token em memória via `auth` (`getAccessToken()`). Se o servidor derruba (token expirou) ou recusa (`unauthorized`), renova com `refreshSession()` — nunca por fora — e reconecta. Em dev, o `StrictMode` abre e fecha uma conexão extra de propósito.
- **Toda chamada à API passa por `api()`** de `lib/api/client.ts`: ele anexa o token, envia cookies (`credentials: 'include'`), renova a sessão num 401 `AUTH_INVALID_ACCESS_TOKEN` e repete a requisição uma vez.
- **Renovação da sessão é serializada** (promise única na aba + Web Locks entre abas). Nunca chame `/v1/auth/refresh` por fora de `refreshSession()`: duas renovações simultâneas com o mesmo cookie fazem o backend revogar a sessão (detecção de reuso).
- Dados do servidor ficam no **TanStack Query** (não em `useState`). Cada feature exporta suas query keys; mutations invalidam as keys afetadas. Ao trocar de sessão, `queryClient.clear()`.
- **Permissões no front são só para montar a tela** (`usePermissions().can(...)`, `<RequirePermission>`, itens de menu com `anyOf`). A segurança é da API. Permissões que o usuário não tem aparecem desabilitadas onde ele concederia algo (regra anti-escalada).
- **Erros:** a API responde `{ code, message }`; a mensagem para o usuário vem de `errorMessage(error)` (mapa por `code` em `api-error.ts`, em pt-BR). Código novo no backend = entrada nova no mapa.
- Validação com Zod no front espelha o **formato**; regras de negócio (telefone E.164, duplicidade) vêm da API e aparecem via `<FormError>`.
- Rótulos das permissões em `features/roles/permissions.ts` — permissão nova no catálogo do backend = entrada nova aqui.
- **Textos da interface em português**; código, nomes de arquivos e rotas em inglês.
- Arquivos em kebab-case; componentes em PascalCase. Um arquivo que exporta componente não exporta hooks/funções (Fast Refresh) — por isso `session.tsx` (provider) e `session-context.ts` (hooks).
- Páginas novas entram no `app/router.tsx` com `lazy` e, se tiverem menu, em `app/navigation.ts`.
- O `AppLayout` tem altura fixa (`h-svh`) e o scroll fica dentro do `<main>`. Telas que ocupam a área inteira, com scroll próprio por coluna (ex.: caixa de entrada), declaram `handle: { fullBleed: true }` na rota — o `<main>` perde o padding. Em layouts de colunas flex, lembre do `min-w-0`/`min-h-0`, senão o conteúdo estoura a tela no celular.
- **Caixa de entrada** (`features/conversations`): rota `/conversations/:id?` (conversa e aba na URL). Atualização em tempo real: o `RealtimeProvider` (no `AppLayout`) recebe `conversation.changed` e invalida as query keys (`conversationKeys`); ao (re)conectar, invalida tudo de conversas. **Polling só com a conexão caída** (`useRealtimeLive()`: lista 5 s, chat 3 s), com aviso "Reconectando…" na lista. O chat usa `flex-col-reverse` com as mensagens da mais recente para a mais antiga (scroll começa no fim); a mensagem enviada aparece na hora (otimista) e o refetch traz a do servidor.

## Testes e2e

- `e2e/account-lifecycle.spec.ts` cobre cadastro, sessão sobrevivendo ao reload, convite, logout, aceite e permissões do Agent.
- Os testes criam dados reais com e-mails `@teste.dev` no banco de desenvolvimento.
- O cadastro tem limite de 5 por hora por IP: rodar a suíte várias vezes seguidas esbarra nele ("Muitas tentativas"). Em dev, zere os contadores apagando as chaves `rate-limit:*` do Redis.
- Seletores por papel e rótulo acessível (`getByRole`, `getByLabel`), nunca por classe CSS.
