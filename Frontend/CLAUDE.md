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
- **Nomes de colegas:** `useMemberNames()` (`features/members/api.ts`, sobre `GET /v1/members/directory`, aberto a todos) — use para responsável, remetente e membros de equipe; não use `/v1/members` (exige `members:manage`). O próprio usuário é `useMe().membershipId`.
- **Equipes** (`features/teams`, rota `/settings/teams`, `teams:manage`): criar, renomear, membros, excluir. A equipe de cada canal é definida na página de Canais.
- **Contatos** (`features/contacts`): lista com busca e filtro de origem **na URL** (`?q=&source=`, busca aplicada após pausa na digitação); ficha em `/contacts/:id` com dados e origem, edição, **histórico de atendimentos** (conversas do contato, via `conversationsApi.byContact`) e **notas internas**. O nome do contato no cabeçalho do chat leva à ficha. Rótulos das origens em `lead-source.ts` (espelho do backend). "Importar planilha" (`import-dialog.tsx`, `contacts:edit`) mostra o relatório com o erro de cada linha (`messageForCode`).
- **Integrações** (`features/integrations`, rota `/settings/integrations`, `integrations:manage`): chaves de API — a chave completa só aparece no diálogo de criação (não guardar em estado além dele); revogar com confirmação; guia de conexão do formulário do site com o endereço `VITE_API_URL/v1/public/leads`.
- **Mídia das conversas:** o arquivo vem da API com o token (`apiBlob` / `useMessageMedia`) e vira URL `blob:` — `<img src>` direto na API não mandaria o `Authorization`. Só exibe imagem/áudio/vídeo dos tipos de `media-kind.ts` (espelho do backend); **o resto é só download (`<a download>`), nunca aberto numa aba** — uma URL `blob:` tem a origem do app, e um HTML/SVG rodaria script nela. Upload por `FormData` no `api()` (sem `content-type` manual).
- Ícones do Lucide são `aria-hidden`: rótulo acessível vai num elemento em volta (`<span role="img" aria-label>`), não no ícone.
- **Quadros** (`features/boards`, rotas `/boards` e `/boards/:id` — esta com `fullBleed`): arrastar e soltar com `@dnd-kit`. Mouse/toque arrastam o card por qualquer ponto; **teclado pela alça** (botão "Mover card de …": espaço pega, setas movem, espaço solta) — só a alça tem papel de botão, o card continua item de lista com link e menu. Durante o arraste a ordem é local (estado + **ref**, para o "soltar" não ler uma ordem antiga) e, ao soltar, vai para a API como `afterCardId` (card logo acima), com atualização otimista no cache. Menu do card: "Mover para" (topo da coluna), abrir conversa, remover. Estrutura (colunas, configuração, entrada automática) só com `boards:manage`. No chat: `PlacementLinks` ("Quadro › Coluna") e `AddToBoardDialog`. Tempo real: `board.changed` recarrega o quadro; `conversation.changed` recarrega os cards.
- **E-mail e SMS** (`features/messaging`, rota `/settings/messaging`, `messaging:manage`): um cartão por canal (`ProviderCard`: situação, último erro do provedor, envio de teste, remover) com o formulário do provedor (`provider-forms.tsx`). O segredo nunca vem da API: o campo mostra "•••• 1234 — deixe vazio para manter" e só é enviado se preenchido. O formulário usa `key={updatedAt}` para recomeçar com o que está salvo.
- **Envio pela ficha** (`features/messaging/contact-messaging.tsx`): `ContactSendButtons` no cabeçalho do contato (desabilitados com o motivo no `title`: canal não configurado, sem endereço, descadastrado — `GET /v1/messaging/channels` diz só se o canal existe) e `ContactMessages` (histórico com status; atualiza sozinho a cada 5 s enquanto houver mensagem "na fila"/"enviado"; avisos de descadastro com "Reativar" para `messaging:manage`). Contagem de segmentos de SMS em `sms.ts`. Na configuração, os endereços de webhook para colar no SendGrid/Twilio e a chave de verificação do SendGrid.
- **Automações** (`features/boards/automations`, só com `boards:manage`): botão ⚡ no cabeçalho de cada coluna (com a contagem) abre o diálogo da coluna — regras descritas em português (`describe.ts`), ativar/desativar, criar/editar (`RuleForm`: gatilho, tempo em minutos/horas/dias, ações), últimas execuções com o motivo de falhas. Mensagens automáticas no chat mostram "Automação" como remetente (`message.automated`).
- **Tabulações** (`features/dispositions`, rota `/settings/dispositions`, `dispositions:manage`): catálogo com cor (`colors.ts`: classes Tailwind literais por cor, espelho da paleta do backend) e `<DispositionBadge>`. `useDispositions()` traz todas (inclusive arquivadas, para nomear o histórico); `useDispositionLookup()` resolve o `dispositionId` das conversas. No chat, "Tabular" e "Resolver" usam o `TabulateDialog` (modo `resolve` quando a conta tem tabulações ativas e o atendimento não foi tabulado; se a API responder `CONVERSATION_DISPOSITION_REQUIRED`, o chat abre o diálogo). O badge aparece no cabeçalho do chat, na lista e no histórico do contato.
- **Caixa de entrada** (`features/conversations`): rota `/conversations/:id?` (conversa, aba e filtro `assignee=me|none` na URL). Ações no cabeçalho do chat: "Assumir" (sem responsável) e "Transferir" (`conversations:assign`, equipe e/ou pessoa). Atualização em tempo real: o `RealtimeProvider` (no `AppLayout`) recebe `conversation.changed` e invalida as query keys (`conversationKeys`); ao (re)conectar, invalida tudo de conversas. **Polling só com a conexão caída** (`useRealtimeLive()`: lista 5 s, chat 3 s), com aviso "Reconectando…" na lista. O chat usa `flex-col-reverse` com as mensagens da mais recente para a mais antiga (scroll começa no fim); a mensagem enviada aparece na hora (otimista) e o refetch traz a do servidor.

## Testes e2e

- `e2e/account-lifecycle.spec.ts` cobre cadastro, sessão sobrevivendo ao reload, convite, logout, aceite e permissões do Agent.
- Os testes criam dados reais com e-mails `@teste.dev` no banco de desenvolvimento.
- O cadastro tem limite de 5 por hora por IP: rodar a suíte várias vezes seguidas esbarra nele ("Muitas tentativas"). Em dev, zere os contadores apagando as chaves `rate-limit:*` do Redis.
- Seletores por papel e rótulo acessível (`getByRole`, `getByLabel`), nunca por classe CSS.
