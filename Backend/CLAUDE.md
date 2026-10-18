# Backend — NestJS

Monólito modular em NestJS (adapter **Fastify**) com Clean/Hexagonal Architecture. Leia também o [CLAUDE.md da raiz](../CLAUDE.md).

## Stack

- NestJS 12 + `@nestjs/platform-fastify`
  - O Nest 12 é publicado **só em ESM**; o projeto é CommonJS e funciona via `require(esm)` do Node 24. Por isso o Jest roda com `--experimental-vm-modules` (já embutido no `npm test`)
- TypeScript **6** — não atualizar para 7 até o Nest CLI suportar (o TS 7.0 não expõe a API de compilação que o CLI usa)
  - O TS 6 exige `rootDir` explícito e não inclui mais `@types/*` automaticamente: todo pacote de tipos global (ex.: `@types/jest`) precisa estar em `compilerOptions.types`
- Install scripts de dependências ficam negados em `allowScripts` (npm 11), salvo necessidade comprovada
- Prisma **7.10** (Postgres, driver adapter `@prisma/adapter-pg`) — versões fixas (sem `^`), `prisma` e `@prisma/client` sempre na mesma versão. A tag `latest` do npm aponta para um RC da 8: nunca instalar sem versão explícita
  - Schema dividido por módulo, um schema Postgres por módulo
  - Client gerado em `src/shared/infra/prisma/generated/` (não versionado; gerado no `postinstall`)
  - Install scripts do `prisma`/`@prisma/engines` negados via `allowScripts` — não são necessários
- Zod para validação de entrada (via `ZodValidationPipe` próprio, em `shared/http`) e das env vars
- BullMQ (`@nestjs/bullmq`) + Redis para filas; outbox próprio para eventos de domínio
- Socket.IO com Redis adapter para tempo real
- `nestjs-cls` + `@nestjs-cls/transactional` (adapter Prisma) para contexto por requisição (tenant), transações e correlation ID
- `eslint-plugin-boundaries` + `no-restricted-imports` para as fronteiras de arquitetura
- Pino (`nestjs-pino`) para logs estruturados; health checks próprios (`HealthService`)
- Jest para testes

## Comandos

```bash
npm run dev                   # API + worker + conector do WhatsApp em watch mode (um terminal, saída prefixada)
npm run start:dev             # só a API
npm run start:worker:dev      # só o worker
npm run start:connector:dev   # só o conector do WhatsApp (Baileys)
npm run build
npm run lint               # inclui a checagem de fronteiras entre módulos
npm run format             # Prettier (aspas simples, trailing comma, 100 colunas)
npm test                   # unitários (test:watch, test:cov)
npm run test:e2e           # integração contra Postgres/Redis do Docker, em banco próprio (test/e2e)
npm run prisma:migrate -- --name <nome>   # nova migration + regenera o client
npm run prisma:generate
```

O Prisma 7 não roda mais o `generate` após o `migrate dev` — use o script, não o comando direto.

Em ambiente **não interativo** (agente, CI), `prisma migrate dev` pode travar esperando entrada e segurar o advisory lock do banco. Nesse caso: `npx prisma migrate dev --create-only --name <nome>`, revisar o SQL gerado, `npx prisma migrate deploy` e `npm run prisma:generate`.

## Estrutura

```
src/
├── main.ts / app.module.ts          # processo API (HTTP + WebSocket)
├── worker.ts / worker.module.ts     # processo Worker (consumidores de fila)
├── whatsapp-connector.ts            # processo whatsapp-connector (Baileys, ADR 0006)
├── contracts/                       # contratos de fila entre processos (jobs + chaves Redis)
├── connectors/whatsapp/             # o conector: sessões, lease, estado cifrado, normalização
├── config/                          # env.schema.ts (Zod) — o boot falha se a env for inválida
├── health/
├── shared/                          # shared kernel — SEM regra de negócio
│   ├── domain/                      # Entity, AggregateRoot, DomainEvent, DomainError/UnauthorizedError/NotFoundError/ConflictError
│   ├── application/                 # ports genéricos: ActorContext, TenantContext, EventBus, IdGenerator, UnitOfWork; pagination
│   ├── infra/                       # shared-infra.module.ts (liga ports → adapters), prisma, redis, rate-limit, events, context (CLS), id
│   ├── http/                        # shared-http.module.ts, DomainErrorFilter, ZodValidationPipe, @Public, TrustedOriginGuard
│   └── testing/                     # fakes dos ports do shared kernel (só para .spec.ts)
└── modules/
    └── <modulo>/
        ├── <modulo>.module.ts
        ├── <modulo>.worker.module.ts   # só se o módulo tiver processors de fila
        ├── index.ts                    # API PÚBLICA do módulo
        ├── domain/                     # entidades, value objects, eventos, erros
        ├── application/
        │   ├── ports/                  # interfaces + tokens de injeção
        │   ├── use-cases/<caso>/       # <caso>.use-case.ts, <caso>.input.ts, <caso>.use-case.spec.ts
        │   ├── event-handlers/
        │   └── <modulo>.facade.ts      # o que outros módulos podem chamar
        ├── infra/                      # repositórios Prisma, mappers, processors, clients externos
        ├── http/                       # controllers, presenters, gateways WS, dto/
        └── testing/                    # repositórios em memória etc. (só para .spec.ts; fora do build)
prisma/schema/                          # base.prisma + um <modulo>.prisma por módulo
```

O módulo `contacts` é a **implementação de referência** da estrutura: na dúvida sobre onde algo fica ou como é escrito, siga o que ele faz.

Módulos iniciais:

- `identity` — users, credenciais, sessões e tokens (rotas `/v1/auth/refresh` e `/v1/auth/logout`). Não conhece tenants além dos ids gravados na sessão.
- `accounts` — tenants (e a hierarquia deles), memberships, roles, convites, catálogo de permissões e cargos padrão. Rotas: `/v1/auth/signup`, `/v1/auth/login` e `/v1/auth/switch-account` (envolvem tenants), `/v1/me` (+ `/v1/me/accounts`), `/v1/members`, `/v1/invitations` (+ `lookup` e `accept`, públicas), `/v1/roles` e `/v1/accounts` (contas abaixo). Depende de `identity`, **nunca o contrário**.
- `contacts` — contatos (leads) e notas internas. Rotas `/v1/contacts` (`contacts:view`; escrita `contacts:edit`): listar com busca `q` (nome, e-mail ou dígitos do telefone) e filtro `source`, criar, `GET/PATCH /:id`, `GET/POST /:id/notes`, `DELETE /:id/notes/:noteId`.
  - **Origem do lead** (`domain/lead-source.ts`): `whatsapp` (criado pela primeira mensagem, via `ContactsFacade.findOrCreateByPhone`), `manual`, `import`, `web_form`, `web_chat`, `web_booking`, + `sourceDetail` livre (campanha, página). A origem **não é editável** (é histórico); a edição mexe só em nome, telefone e e-mail, com as mesmas regras da criação.
  - **Notas:** o autor é o membro autenticado (`ActorContext`), nunca um id do cliente; só o autor apaga. O histórico de atendimentos da ficha vem do módulo conversations (`GET /v1/conversations?contactId=`), respeitando o escopo de quem consulta.
- `channels` — canais de atendimento com **tipo** (`provider`): WhatsApp via Baileys (`whatsapp_baileys`; depois a API oficial) e **chat do site** (`web_chat`, ADR 0012). Rotas `/v1/channels` (permissão `channels:manage`): listar, criar, `GET /:id/connection` (status + QR), `connect`, `disconnect`, `test-message`, `PATCH /:id/team` (equipe que recebe as conversas novas) e `DELETE /:id`. Não fala com o WhatsApp: enfileira comandos para o conector e aplica os relatos dele (worker).
  - **Chat do site:** nasce ligado (`connected`; desligar = `disconnected`, sem QR nem conector), com `publicKey` (chave do widget, única; `PATCH /:id/web-chat { rotateKey }` troca) e `settings` (título, saudação, cor; mesmo `PATCH`). `POST /v1/channels { name, type: 'whatsapp' | 'web_chat' }`; connect/disconnect ligam e desligam; mensagem de teste e anexos só no WhatsApp (`CHANNEL_NOT_WHATSAPP`). A mensagem do visitante (`ChannelsFacade.receiveWebChatMessage`) vira o mesmo `channel.message.received.v1`, com `contactId` (contato já identificado). `ChannelSender` no chat do site: avisa o widget (`chat.message` na sala do visitante, namespace `/chat`) e publica o send-result `sent` na hora. `webChatByKeyAsSystem` (sem tenant: a chave diz a conta) e `webChat(id)` para o widget e os sites. O `PurgeConnectorSessionHandler` só age em WhatsApp.
- `conversations` — conversas e mensagens. **Uma conversa por (canal, contato)**, status `open`/`pending`/`resolved` (mensagem do cliente reabre). Entrada pelo evento `channel.message.received.v1` (worker): acha/cria o contato pelo telefone (`ContactsFacade`), acha/abre a conversa e grava a mensagem — idempotente pelo `externalId` (único por canal). Resposta: `POST /v1/conversations/:id/messages` grava `pending` e enfileira via `ChannelsFacade` **depois** do commit; o resultado chega por `channel.message.send-result.v1`. Quem responde uma conversa sem responsável a assume. Rotas: `GET /v1/conversations` (cursor opaco, ordem da última mensagem), `GET /:id`, `GET /:id/messages`, `POST /:id/messages`, `POST /:id/status`, `POST /:id/read`. Publica `conversation.message.added.v1`, `conversation.message.status-changed.v1`, `conversation.status-changed.v1` e `conversation.assigned.v1`.
  - **Escopo (`VisibleConversations` + `domain/visibility.ts`):** `view:all` vê tudo; `view:team` (supervisão) vê todas as conversas das suas equipes, as atribuídas a ele e a fila geral; `view:own` (atendimento) vê as atribuídas a ele e a **fila** — sem responsável, das suas equipes ou sem equipe. Conversa fora do escopo responde 404. A consulta Prisma (`scopeFilter`) e as salas do tempo real (`audience`) espelham a mesma regra: mudou uma, mude as três.
  - **Equipe da conversa:** herdada da equipe do canal ao abrir; muda por transferência. Sem equipe = fila geral.
  - **Atribuição:** `POST /:id/claim` (qualquer escopo; só conversa sem responsável — senão 409) e `POST /:id/transfer` (`conversations:assign`; `{ teamId?, assigneeId? }`, ausente = não muda, `null` = tira; mudar só a equipe devolve para a fila dela). Responder uma conversa sem responsável também a assume. Filtros da lista: `assignee=me|none` e `contactId` (histórico na ficha do contato).
  - Contatos só com LID (sem telefone) ainda são ignorados na entrada (log de aviso). Mensagem com `contactId` (chat do site) usa o contato direto.
  - **Para quem vai a resposta:** `ConversationRecipient` (telefone no WhatsApp — sem telefone, 409; o `contactId` no chat do site), usado pela resposta, pelo anexo (chat do site: 422 `CONVERSATION_CHANNEL_TEXT_ONLY`) e pela mensagem automática. `ChannelInfo.kind` (`whatsapp` | `web_chat`) e `contact.email` vão no presenter. `ConversationsFacade.webChatHistory` (só texto, desde o começo da sessão do visitante, sem as que falharam) é o que o widget mostra.
- `teams` — equipes de atendimento (ADR 0003: o cargo define o quê; a equipe, sobre quais dados). Rotas `/v1/teams`: listar (`teams:manage` ou `conversations:assign`), criar, renomear, `PUT /:id/members` (só membros ativos) e excluir (`teams:manage`). Excluir publica `team.deleted.v1`: channels e conversations limpam o `teamId` (voltam à fila geral). `TeamsFacade` dá as equipes de um membro (escopo e salas).
- `catalog` — o que o negócio oferece e quem atende: **serviços** (`Offering` no código, para não confundir com os services do Nest; tabela `services`) com duração (5 min a 12 h, é o que ocupa na agenda), preço em centavos (`null` = sob consulta), "mostrar no site" e ativo/inativo; **profissionais** com função, texto, serviços que faz e **vínculo opcional a um membro** (quem tem login; um membro = no máximo um profissional — quem só atende é só cadastro). Rotas `/v1/catalog/services` e `/v1/catalog/professionals`: ler é aberto a todo membro (agenda e atendimento usam); escrever exige `catalog:manage` (Admin por padrão). Excluir serviço tira-o da lista dos profissionais. Base da agenda e do site (`CatalogFacade.agendaCatalog`: serviços e profissionais com os ids dos serviços, inclusive inativos).
- `forms` — formulários do site (`contact` ou `service`), geridos em `/v1/forms` (`forms:manage`, Admin por padrão; envios de um contato em `GET /v1/forms/submissions?contactId=` com `contacts:view`). **Envio público** em `POST /v1/public/forms/:key`: `<form method="post">` puro no site, sem JavaScript, sem CORS e **sem chave de API** — a chave pública (24 caracteres aleatórios) autentica o envio no `FormKeyGuard`, que fixa o tenant (como o guard da chave de API). Aceita urlencoded ou JSON; campos `nome`, `telefone`, `email`, `mensagem`, `servico`, `data_preferida` (e os nomes em inglês). Navegador: 303 para a página de obrigado do site (`successUrl`) ou a nossa (`GET /v1/public/forms/obrigado`); erro de domínio vira página HTML 422 com o motivo e "voltar" (Referer só se for http/https). `Accept: application/json`: 201 `{ ok: true }` ou o `{ code }` de sempre. **Anti-spam:** campo isca `website` (preenchido = finge sucesso e descarta) e 10 envios por minuto por IP. O contato é registrado pela `ContactsFacade.captureFormLead` (mesmas regras do `/v1/public/leads`, mas SEM o `LeadCapturedEvent`) e o envio guardado (`FormSubmission`, com o nome do serviço copiado); `form.submitted.v1` faz o kanban abrir o negócio nos funis com `autoAddLeads` — solicitação de serviço vira "Corte — Ana" com o preço do serviço como valor. Serviço do envio precisa estar ativo e "mostrar no site" (`CatalogFacade.siteService`). Pausar recusa envios; trocar a chave (`rotateKey`) aposenta o HTML publicado. **Origem do envio:** `?ref=` na ação (ou campo `ref`), até 80 caracteres `[A-Za-z0-9:_.-]` (fora disso, ignorada) → `form_submissions.source_ref` e `sourceRef` no evento; opaca para o forms (as landing pages usam `lp:<variante>`).
- `scheduling` — a agenda (ADR 0013), só na API. Schema `scheduling`: `professional_schedules` (horário semanal em JSON: 7 dias, domingo = 0, faixas em minutos do dia), `time_offs`, `appointments` e `booking_settings` (uma por conta).
  - **Sem sobreposição pelo banco:** constraint `appointments_no_overlap` (EXCLUDE gist em tenant + profissional + `tstzrange [)`, só `status = 'scheduled'`; extensão `btree_gist`). O `PrismaAppointmentRepository.save` traduz o 23P01 em 409 `APPOINTMENT_SLOT_TAKEN`. O Prisma não conhece a constraint (o `migrate diff` a ignora): mexeu em `appointments`, confira que ela continua lá.
  - **Fuso** da conta em `booking_settings.timezone` (padrão `America/Sao_Paulo`); datas locais `AAAA-MM-DD` e minutos do dia, convertidos só com `Intl` (`domain/zoned-time.ts`). Sem horário salvo vale `DEFAULT_WEEKLY_HOURS`; sem configuração salva valem os padrões (e `publicKey: null` no `GET` — a chave nasce na primeira gravação).
  - **Horários livres** (`application/availability.ts` + `domain/availability.ts`): faixas do dia − agendamentos ativos − bloqueios, passo `slotStepMinutes` a partir do começo de cada faixa, cabendo a duração do serviço. "Qualquer profissional" junta os livres de todos os que fazem o serviço.
  - **Painel** (`/v1/agenda`, `agenda:manage`): `GET day?date` (profissionais com o horário do dia, serviços, agendamentos com o contato, bloqueios), `GET slots`, `POST appointments` (pode encaixar fora do horário, não sobrepor), `PATCH appointments/:id` (remarcar mantendo a duração, trocar profissional, observações), `POST appointments/:id/status` (`completed`/`no_show`/`canceled` com motivo, ou de volta a `scheduled`), `GET contacts/:id/appointments`, `GET settings`. Com `catalog:manage`: `GET/PUT professionals/:id/schedule` (o `GET` traz o fuso), `POST professionals/:id/time-offs`, `DELETE time-offs/:id`, `PATCH settings` (`enabled`, fuso, passo, antecedência, janela, `rotateKey`). O agendamento copia nome e preço do serviço.
  - **Agendamento online** (`/v1/public/booking`, `@Public`, throttle por rota): `GET widget.js` (`http/assets/booking-widget.js`, mesmo esquema do widget do chat: `assets` do nest-cli, fora do ESLint), `GET :key` (hoje, janela, fuso, serviços e profissionais "mostrar no site"), `GET :key/slots`, `POST :key/appointments` (isca `website`; nome + telefone e/ou e-mail → `ContactsFacade.captureBookingLead`, origem `web_booking`). `ResolveBookingKey` acha a conta pela chave (só ligado) e entra no tenant. O `PublicBookUseCase` recalcula os livres e só aceita um deles; com "qualquer um", tenta cada profissional livre (conflito → o próximo). CORS: `/v1/public/booking/*` entra no mesmo `widgetCors` do chat (`main.ts`).
  - Publica `appointment.booked.v1`: o kanban abre negócio só para `source = 'site'` (`KanbanBookingEntryHandler`). `SchedulingFacade.onlineBookingKey()` dá a chave ao módulo de sites.
- `webchat` — o lado público do chat do site (ADR 0012), só na API. Rotas `@Public` em `/v1/public/chat`: `GET widget.js` (o script do widget: `http/assets/chat-widget.js`, JS de navegador sem dependências, copiado para o `dist` pelo `assets` do nest-cli e fora do ESLint), `GET :key` (título, saudação, cor, ligado), `POST :key/sessions` (nome + telefone e/ou e-mail → contato pela `ContactsFacade.captureChatLead`, origem `web_chat` → token), `GET/POST messages` (`VisitorGuard`: `Authorization: Bearer <token do visitante>`, fixa o tenant; mensagem com `id` do widget = idempotência). **CORS:** só `/v1/public/chat/*` aceita qualquer origem, sem credenciais (`delegator` no `main.ts`). Token do visitante: HMAC sem estado (`HmacVisitorTokens`, chave derivada do JWT_SECRET com rótulo próprio), 30 dias, com o começo da sessão (o histórico começa ali). **WebSocket do visitante:** `WebChatGateway`, namespace `/chat`, autentica pelo token (`AuthenticateVisitorUseCase.verify` — o handshake não tem CLS, então não entra em tenant), sala `RealtimeRooms.webChatVisitor`, só sinal. O widget carrega o cliente Socket.IO servido pela própria API (`/socket.io/socket.io.min.js`) e cai para consulta a cada 5 s sem WebSocket.
- `sites` — o site de cada conta (ADR 0010). **Modelos** (`/v1/site-templates`, `sites:manage` + conta raiz, conferida no `TemplateKeeper` → 403 `SITE_TEMPLATES_ROOT_ONLY`): documento HTML com marcadores Mustache; nasce rascunho com o `STARTER_TEMPLATE_HTML`; `available` libera para as contas (`GET available`, qualquer conta); marcador ilegível → 422 `SITE_TEMPLATE_INVALID_HTML` com o motivo na `message`; modelo usado por algum site não se exclui. **Site** (`/v1/site`, `sites:manage`, um por conta): `GET` (site ou null + `publishingEnabled` + `addressPattern`), `POST {templateId}` (slug sugerido pelo da conta, com sufixo se ocupado), `PATCH {content?, slug?, templateId?}`, `POST preview` (HTML com o conteúdo em edição, sem gravar), `POST publish|unpublish` (202), `GET/POST/DELETE assets` (multipart `file`).
  - **Conteúdo** (`domain/site-content.ts`): JSON único para qualquer modelo; `normalizeSiteContent` apara textos (vazio = null), põe o WhatsApp em E.164 e confere cor/e-mail/limites; `completeSiteContent` completa JSON antigo com os padrões (campo novo não exige migration). Serviços e profissionais vêm do `CatalogFacade` (`siteOfferings`/`siteProfessionals`: ativos e "mostrar no site") e o formulário do `FormsFacade.siteForm` (ativo; `action` = `PUBLIC_API_URL` + caminho).
  - **Agendamento no site:** seção `booking` (ligada por padrão); com o agendamento online ligado (`SiteSources.booking`), o compositor injeta o script do widget e, se o modelo não tiver `<div data-omni-booking>`, cria uma seção antes do `<footer` (`withBookingPlace`). `sections.booking` = ligada **e** agendamento ligado.
  - **Chat do site no site:** `content.chatChannelId`; o `SiteComposer` põe o `<script>` do widget antes do `</body>` quando o chat está ligado (`SiteSources.chat`; prévia com `data-preview="1"`) e o view ganha `chat.enabled`.
  - **View dos modelos** (`application/site-view.ts`) é contrato: só acrescente campo (e espelhe em `Frontend/src/features/sites/markers.ts`). Todo item de lista tem todas as chaves (null quando vazio) — no Mustache, chave ausente é procurada no contexto de fora. `sections.x` = ligada **e** com conteúdo. O renderizador (`MustacheSiteRenderer`) usa um `Writer` por chamada (o cache global cresceria sem limite) e escapa só `& < > " '`.
  - **Publicação:** o site guarda `pendingAction`; o job `ProcessSiteJob` (fila `sites`, `SitesWorkerModule`) faz o que estiver pendente — grava `<slug>/index.html` no bucket público e apaga o endereço antigo; erro do modelo vira `lastError` na hora, erro do bucket volta para a fila (esgotou: `SITE_HOSTING_UNAVAILABLE`). `SiteRepository.save` grava só a edição e `savePublication` só o estado da publicação (tela e worker não se atropelam). O slug é único entre as contas, contando o endereço ainda no ar; reservados em `RESERVED_SLUGS` (`media` = imagens).
  - **Imagens:** original no bucket privado (`tenants/<t>/site-assets/<id>`) e cópia pública em `media/<t>/<id>.<ext>` no bucket de sites (`S3SiteHosting`, configurado por `SITES_BUCKET` + `SITES_URL`; sem eles, publicar e enviar imagem → `SITES_NOT_CONFIGURED`). JPEG/PNG/WebP/GIF até 5 MB; imagem usada pelo rascunho não se exclui.
  - **Domínio próprio** (ADR 0011): `customDomain` (único, com e sem www — `domainVariants`), normalizado por `validCustomDomain` (URL global: minúsculas e punycode; recusa IP e o subdomínio nosso). Só muda com `AccountsFacade.actingFromParentAccount()` ou na conta raiz (403 `SITE_DOMAIN_MANAGED_ABOVE`); `GET /v1/site` traz `canManageDomain` e `domainTarget` (`SITES_DOMAIN_TARGET`). Publicar grava também a pasta do domínio, o `.well-known/daedalus-site.txt` (id do site, **sem cache**) e, para www, a página de redirecionamento no domínio sem www (`domain-pages.ts`); depois marca `checking` e enfileira `CheckSiteDomainJob` (o `HttpSiteDomainChecker` busca o arquivo pelo domínio, sem seguir redirect; em dev, `SITES_DOMAIN_CHECK_VIA` conecta direto no nginx). `POST /v1/site/domain/check` pede de novo. `saveDomainStatus` só grava se o domínio ainda for o mesmo.
  - **Modelos com tipo** (`kind`: `site` | `landing`, fixo após criar): cada tipo tem modelo inicial (`STARTER_TEMPLATE_HTML` / `STARTER_LANDING_TEMPLATE_HTML`) e exemplo na prévia (`sampleSiteInput` / `sampleLandingInput`); `GET available?kind=`; `choosableTemplate(…, kind)` (`application/template-choice.ts`) recusa o tipo errado (`SITE_TEMPLATE_WRONG_KIND`). `countSitesUsing` conta sites e variantes de landing.
  - **Landing pages** (ADR 0014; `/v1/landing-pages`, `sites:manage`): `LandingPage` (agregado com as variantes `a`–`d`, máx. 4; caminho único na conta; formulário da conversão; máx. 30 por conta) — listar (com visitas/conversões), criar (precisa do site: `LANDING_SITE_REQUIRED`), `GET/PATCH/DELETE /:id` (excluir só fora do ar: `LANDING_IS_LIVE`), `POST /:id/variants` (cópia de `copyFrom`), `PATCH|DELETE /:id/variants/:vid` (nome, modelo, conteúdo, peso 0–100; ao menos uma com peso), `POST /:id/variants/:vid/winner` (peso 100 nela, 0 nas outras; no ar, publica), `POST /:id/preview`, `publish`/`unpublish` (fila `sites`, job `process-landing`), `GET /:id/stats` (por variante, comparada com a A: `domain/ab-test.ts`, duas proporções, mín. 100 visitas, p < 0,05) e `POST /:id/stats/reset`.
    - **View dos modelos de landing** (`application/landing-view.ts`, contrato como o do site — espelho em `markers.ts` do front): `business`/`theme`/`logo` do site da conta (pelo próprio `buildSiteView`), `hero` (o botão vai a `#formulario`, ou ao WhatsApp sem formulário), `introParagraphs`, `benefits`, `offer`, `testimonials`, `faq`, `contactForm` (+ `title`), `sections.*`, `site.url`/`site.homeUrl`, `landing.variant`.
    - **Publicação** (`ProcessLandingUseCase`): em cada pasta do site (`landingLocation`: slug publicado — ou o atual — e domínio publicado), `<caminho>/index.html` = a variante (uma com peso) ou o sorteio (`splitPage`, `localStorage`, redireciona para `/<caminho>/<letra>/` com a query); letra que saiu vira redirecionamento (`retiredVariantPage`); pasta/caminho antigos saem. Guarda `publishedFolders`/`publishedPath`/`publishedCodes` para tirar do ar só o que gravou. Publicado (não prévia), o `LandingComposer` põe `?ref=lp:<variante>` na ação do formulário e o script de visita antes do `</body>`.
    - **Site muda de endereço, entra ou sai do ar** → `LandingRelocator.relocate` (chamado no `ProcessSiteUseCase` e no `UpdateSiteUseCase` com o site fora do ar) publica de novo as landing pages no ar.
    - **Contagem:** `POST /v1/public/landing/views/:variantId` (`@Public`, sem corpo, 30/min por IP, sempre 204; só conta com a página no ar) soma em `landing_views` (por dia UTC, `ON CONFLICT`). Conversão: `LandingConversionHandler` no `form.submitted.v1` com `sourceRef = lp:<variante>` da mesma conta → `landing_conversions` (id = o do envio: idempotente). Imagem usada por variante não se exclui (`isAssetUsed`).
  - Exceções conscientes ao filtro de tenant (só leitura, documentadas nos ports): `findForSite`, `listAvailable` e `countSitesUsing` dos modelos, `isSlugTaken`, `isDomainTaken` e `findVariantOwnerAsSystem` (a variante diz a conta, na rota pública).
- futuro: `audit` (alimentado por eventos)

## Regras de camadas

- `domain/` é **TypeScript puro**: nenhum import de `@nestjs/*`, Prisma, Zod ou qualquer lib de infraestrutura. Regras de negócio e invariantes ficam aqui, nas entidades — não nos use cases nem nos controllers.
- `application/` depende só de `domain/` e de ports. Único acoplamento aceito ao Nest: `@Injectable()` e `@Inject(TOKEN)`.
- `infra/` e `http/` implementam ports e podem usar qualquer lib.
- Dependências apontam **para dentro**: `http → application → domain` e `infra → application/domain`. Nunca o contrário.
- Ports são interfaces + um `Symbol` como token; a ligação port → adapter acontece **somente** no `<modulo>.module.ts`.
- **Nunca use alias de tipo (`type X = ...`) em parâmetro de construtor injetado**: o TypeScript grava `Object` nos metadados e o Nest não resolve a dependência. Escreva a classe (`TransactionHost<...>`) ou use `@Inject(TOKEN)`.
- Controllers são finos: validam (DTO), chamam **um** use case e mapeiam a resposta. Sem regra de negócio.
- Um use case = uma classe com um método público `execute(input)`.

## Regras de módulos

- Um módulo só importa de outro através do `index.ts` dele. Importar arquivos internos de outro módulo é proibido (o lint barra).
- As fronteiras são verificadas pelo `npm run lint` (`eslint.config.mjs`): direção das camadas, acesso entre módulos só via `index.ts`, domínio sem pacotes externos, `testing/` só em `.spec.ts`. As regras são genéricas por padrão de pasta — módulos novos são cobertos sem alterar a config.
- Comunicação entre módulos: **síncrona** via Facade exportada, ou **assíncrona** via eventos (preferível quando o chamador não precisa da resposta).
- Quem consome a facade de outro módulo declara um **port gateway** em `application/ports/` (ex.: `IdentityGateway` em accounts) com o que precisa, nos seus termos, e um adapter em `infra/` sobre a facade. Use cases nunca recebem a facade de outro módulo direto.
- Cada módulo é dono das suas tabelas. Repositórios de um módulo só acessam os models do próprio módulo.
- **Sem relations do Prisma entre models de módulos diferentes** — guarde só o ID (`contactId: String`). Sem JOIN entre módulos.
- `shared/` não pode depender de nenhum módulo.

## Dados (Prisma)

- Cada `prisma/schema/<modulo>.prisma` declara seus models com `@@schema("<modulo>")`, e o schema entra na lista `schemas` do datasource em `base.prisma`.
- No banco, nomes em snake_case: `@map("tenant_id")` nas colunas e `@@map("contacts")` nas tabelas; no código, camelCase.
- Colunas de id/tenant são `@db.Uuid`; datas são `@db.Timestamptz(3)`.
- Violação de `@@unique` (P2002) é traduzida no repositório para o `ConflictError` do domínio, identificando a constraint pelo nome gerado (`<tabela>_<colunas>_key`).
- Tipos gerados pelo Prisma **nunca saem de `infra/`**. O repositório converte com um mapper (`toDomain` / `toPersistence`).
- IDs são UUIDv7 gerados pela aplicação (via port `IdGenerator`), não pelo banco.
- Toda tabela de negócio tem `tenantId` e toda query filtra por ele. Exceções conscientes, documentadas no port: tabelas globais do `identity` (users, sessions) e as consultas de login do `accounts` (tenants/memberships são a origem do tenant).
- Relations (FKs) só entre models do mesmo módulo.
- Repositórios acessam o banco **sempre** por `TransactionHost.tx` (nunca pelo `PrismaService` direto), para participar da transação em andamento.
- Use cases com mais de uma escrita envolvem o trabalho em `unitOfWork.run(...)` (port `UnitOfWork`, token `UNIT_OF_WORK`) — **não** usar o decorator `@Transactional()`, que acopla a application ao nestjs-cls e quebra os testes com `new`. A transação vale entre módulos (ex.: cadastro grava em identity e accounts).
- Migrations sempre pelo Prisma; nunca alterar o banco manualmente.
- O `prisma migrate dev --create-only` pede confirmação (ex.: ao criar unique) e falha em shell não interativo. Alternativa: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script > prisma/migrations/<timestamp>_<nome>/migration.sql` e depois `prisma migrate deploy`.

## Eventos, filas e worker

- **Três processos, a mesma imagem:** `api` (`main.ts`), `worker` (`worker.ts`, sem HTTP — só health check em `WORKER_HEALTH_PORT`) e `whatsapp-connector` (`whatsapp-connector.ts`, health check em `CONNECTOR_HEALTH_PORT`; ver seção própria).
- **Eventos de domínio usam outbox:** `EventBus.publish` grava o evento em `platform.outbox_events` **na mesma transação** dos dados (o use case deve usar `UnitOfWork`). O `OutboxRelay` (worker) lê os pendentes a cada segundo e cria **um job por consumidor** na fila `domain-events` (id estável `<evento>:<consumidor>`), com retry exponencial.
- **Consumir um evento:** método num provider do módulo (`application/event-handlers/`), marcado com `@HandlesDomainEvent(OutroModuloEvent)`, recebendo `DeliveredEvent<E>` (dados do evento + `eventId`). Roda no worker, no tenant do evento. Entrega é "ao menos uma vez": **todo consumidor é idempotente** (use o `eventId`).
- **Nome de classe de consumidor é único no sistema todo** (o id do consumidor é `Classe.metodo` e vai no id do job): prefixe com o módulo (`ChannelsTeamCleanupHandler`, `ConversationsTeamCleanupHandler`). O registro falha na inicialização se houver repetição.
- Evento de módulo multi-tenant carrega `tenantId` (o do evento prevalece sobre o do contexto). Contrato público e versionado (`message.received.v1`), em `domain/events/`, exportado no `index.ts`.
- **Jobs:** declare com `defineJob<Payload>('<fila>', '<nome>')` e enfileire pelo port `JobQueue` (`JOB_QUEUE`) — sem importar BullMQ na application. Tenant e correlation id seguem no envelope do job automaticamente. `jobId` estável = dedup (ex.: id externo da mensagem); `:` no id é trocado pelo adapter.
- **Processar:** processor em `infra/` que estende `TenantAwareProcessor` (restaura tenant e correlation id), registrado num `<modulo>.worker.module.ts` importado **só** pelo `WorkerModule`; a fila é registrada no módulo com `BullModule.registerQueue`.
- Todo processor é **idempotente** e usa retry com backoff (padrão: 5 tentativas).
- Webhooks de canais: o controller valida a assinatura, enfileira o payload bruto e responde 200. O processamento acontece no worker.
- `QUEUE_PREFIX` separa as filas por ambiente (os testes e2e usam `omni-e2e`).

## Conector do WhatsApp (Baileys)

Processo próprio (`whatsapp-connector.ts`, ADR 0006), mesma imagem. Regras:

- **Só conversa pelo contrato** (`src/contracts/whatsapp-connector.contract.ts`): comandos na fila `whatsapp-connector` (start/stop/send), relatos na fila `whatsapp-events` (status, mensagem recebida, resultado de envio) e o QR code no Redis (`whatsapp:qr:<canal>`, TTL 60 s). O lint barra: `connectors/` nunca importa módulos, e módulos nunca importam `connectors/`.
- Mudar o formato de um job do contrato quebra jobs já enfileirados: só acrescentar campos opcionais, ou criar um job novo (`-v2`).
- **Tabelas próprias** no schema `whatsapp_connector`: `sessions` (estado desejado por canal) e `auth_entries` (credenciais do Baileys, **cifradas** com `ENCRYPTION_KEY` via `SecretBox`). Quem tem esses dados controla o número: nunca logar nem expor.
- **Posse por lease no Redis** (`whatsapp:lease:<canal>`, 30 s, renovado a cada 5 s): cada número tem no máximo uma conexão viva entre todas as instâncias. O `SessionManager` reconcilia a cada 5 s (renova, encerra as indesejadas, assume as sem dono); comandos e reconciliação rodam em fila única por instância.
- Envio numa instância que não é dona da sessão falha e volta para a fila (retry); esgotadas as tentativas, o resultado `failed` é relatado.
- Reconexão: `restartRequired` (após escanear) e fim de ciclo de QR reconectam na hora; outras quedas usam backoff exponencial (até 1 min). Desiste (e marca a sessão como inativa) em logout pelo celular, QR não escaneado em 3 min e `connectionReplaced`.
- SIGTERM encerra as conexões **sem logout** e libera os leases: outra instância reassume sem novo QR.
- Grupos, status, canais (newsletter), reações e mensagens de protocolo são ignorados na normalização (`message-normalizer.ts`).
- Health check em `CONNECTOR_HEALTH_PORT` (padrão 3002).

## Arquivos e mídia

- Port `FileStorage` (`FILE_STORAGE`, shared kernel) sobre a API S3 (`S3FileStorage`, `@aws-sdk/client-s3`): S3 em produção, MinIO em dev — só muda o env (`S3_*`). **Bucket privado; nunca gerar link público nem URL assinada para o navegador**: arquivo sai só pela API, que confere o escopo a cada download.
- Filas e eventos carregam só a **referência** (`StoredMedia`: chave, tipo, tamanho, nome) — o arquivo nunca passa pela fila.
- Chaves: `tenants/<tenant>/channels/<canal>/inbound/<externalId>` (recebidas, gravadas pelo conector) e `tenants/<tenant>/conversations/<conversa>/outbound/<messageId>` (enviadas, gravadas pela API).
- **Recebida:** o conector baixa (`downloadMediaMessage`), respeita `MEDIA_MAX_MB` (pelo tamanho declarado e pelo baixado) e grava; falha ou arquivo grande → a mensagem entra só com o tipo (`media: null`). **Enviada:** `POST /v1/conversations/:id/attachments` (multipart, `caption` antes de `file`, limite aplicado durante o upload → 413 `ATTACHMENT_TOO_LARGE`); o conector lê do armazenamento e envia (`SendWhatsAppMedia`).
- **Servir com segurança** (`shared/domain/media-type.ts`): só imagem/vídeo/áudio de tipos conhecidos vão `inline` com o próprio tipo; **todo o resto (inclusive SVG e HTML) vai como `application/octet-stream` + `attachment`**. Sempre com `X-Content-Type-Options: nosniff` e `Content-Security-Policy: default-src 'none'; sandbox`. Tipo novo exibível = entrada nos dois espelhos (back e front).

## Tempo real (Socket.IO)

- Gateway no processo `api` (módulo `realtime`, caminho `/socket.io`, **só transporte WebSocket**), com `RedisIoAdapter` (`@socket.io/redis-adapter`) entre réplicas. O `socket.io` fica fixado na versão que o `@nestjs/platform-socket.io` usa (hoje 4.8.3) — versões diferentes duplicam o pacote e quebram os tipos.
- **Autenticação na conexão:** `auth.token` = access token, validado pelas mesmas regras do HTTP (`IdentityFacade.authenticateAccessToken` + `AccountsFacade.accessOf`); recusado → `connect_error: unauthorized`. **O servidor derruba a conexão quando o token expira** — o cliente renova e reconecta; nenhuma conexão sobrevive a um acesso revogado por mais que a validade do token. Mudança de cargo só vale para as salas na próxima conexão.
- **Namespaces:** o padrão é o do painel (login); `/chat` (`WEB_CHAT_NAMESPACE`) é o dos visitantes do chat do site (módulo webchat). `RealtimeNotifier.emit(rooms, event, data, namespace?)`.
- **Salas:** `member:<membershipId>`, `tenant:<id>:perm:<permissão>` (uma por permissão do membro) e `team:<teamId>:perm:<permissão>` (por equipe do membro × permissão — ex.: "supervisores da equipe X"). Equipes e cargo são lidos na conexão: mudanças valem na próxima (no máximo a validade do token). O gateway é genérico; **quem emite escolhe as salas** conforme a regra de visibilidade do próprio módulo.
- **Emitir:** port `RealtimeNotifier` (`REALTIME_NOTIFIER`, shared kernel), implementado com `@socket.io/redis-emitter` — funciona de qualquer processo (o worker emite sem ter servidor Socket.IO). Normalmente a partir de um consumidor de evento de domínio (outbox), nunca dentro da transação.
- **O aviso é só um sinal** (ex.: `conversation.changed { conversationId, reason }`), nunca o conteúdo: a tela busca pela API, que aplica permissão e escopo. Aviso perdido não é dado perdido (a tela se corrige ao reconectar).
- Conversas: `NotifyRealtimeHandler` avisa `view:all`, o responsável e — sem responsável — `view:own`/`view:team`; na troca de responsável, avisa também o anterior.
- Latência típica ~1–2,5 s: o outbox é lido a cada 1 s e uma mensagem passa por dois eventos (channels → conversations → aviso).

## Logs e correlation id

- Pino (`nestjs-pino`): JSON em produção, legível em dev. Use o `Logger` do `@nestjs/common` (`new Logger(Classe.name)`); nunca `console.log`.
- Toda linha leva `correlationId` e, quando houver, `tenantId`. O correlation id é o `X-Request-Id` recebido (se válido) ou um novo — definido pelo `genReqId` do Fastify —, devolvido no header da resposta e propagado aos jobs e eventos gerados: uma operação é rastreável da requisição até o worker.
- Nunca logar senha, tokens, cookies ou payloads com dados pessoais (o `redact` do logger cobre headers e campos comuns — não confie só nele).

## HTTP

- CORS (`main.ts`) lista os métodos explicitamente: o `@fastify/cors` só libera GET/HEAD/POST por padrão, e testes com curl não passam pelo preflight — verbo novo em rota usada pelo navegador precisa estar na lista.
- Rotas versionadas: `/v1/...`. DTOs com Zod em `http/dto/`, aplicados com `new ZodValidationPipe(schema)` em `@Body`, `@Query` e `@Param`.
- DTOs validam só o **formato**; regras de negócio (telefone válido, duplicidade) ficam no domínio.
- Respostas passam por um presenter (`<entidade>.presenter.ts`) — a entidade nunca é serializada direto.
- Erros de domínio estendem `DomainError` (com `code` estável, ex.: `CONTACT_INVALID_PHONE`); o `DomainErrorFilter` mapeia para HTTP. Nunca lançar `HttpException` fora de `http/`.
- Corpo de erro sempre `{ code, message }` (+ `issues` em validação). Status: `VALIDATION_ERROR` 400 · tenant ausente e `UnauthorizedError` 401 · `ForbiddenError` 403 · `NotFoundError` 404 · excesso de requisições 429 · `ConflictError` 409 · demais `DomainError` 422.
- Erros de autenticação nunca revelam o que existe: mesma resposta para e-mail inexistente e senha errada; mesma para conta inexistente e sem acesso; logout com token inválido é no-op silencioso.
- Recurso de outro tenant responde **404** (não 403), para não revelar que existe.
- Listagens usam paginação por cursor (`limit` + `cursor`, resposta `{ items, nextCursor }`), ordenadas por id (UUIDv7) decrescente.

## Autenticação, tenant e permissões

- Guard global de JWT: **todo endpoint é autenticado por padrão**; exceções explícitas com `@Public()`.
- Autorização por `@RequirePermissions('recurso:ação')` (exige todas; classe e método se somam) ou `@RequireAnyPermission(...)` (basta uma), importados do `index.ts` do accounts. Permissões vêm do catálogo `PERMISSIONS` — nunca strings soltas. Toda rota de negócio declara a permissão que exige.
- Permissões com escopo de dados (`:own`, `:team`, `:all`): a rota usa `@RequireAnyPermission` com as variantes; o **use case/query aplica o escopo**.
- O tenant da requisição fica no `TenantContext` (nestjs-cls). **Repositórios** leem o tenant do contexto e filtram toda query por ele; use cases e controllers não recebem `tenantId` como parâmetro.
- Jobs de fila carregam `tenantId`; o processor preenche o `TenantContext` antes de executar.
- WebSocket: ver "Tempo real".
- Índices de tabelas de negócio começam pelo `tenantId`.
- Access token (JWT HS256, `JWT_SECRET`, 15 min) contém só `sub` (user), `tid` (tenant), `mid` (membership) e `sid` (sessão); permissões são resolvidas por requisição (cache Redis).
- Refresh token = `<sessionId>.<segredo>`; no banco fica só o SHA-256 do segredo. Rotação a cada uso; reuso de um segredo antigo revoga a sessão inteira.
- Senhas: Argon2id (`@node-rs/argon2`), atrás do port `PasswordHasher`. A senha em texto puro só existe no value object `Password` (que não se serializa).
- `JwtAuthGuard` (identity, `APP_GUARD`) valida o `Authorization: Bearer` e grava o ator no `ActorContext` (CLS); `TenantContext` lê o tenant dele. Rotas abertas usam `@Public()` (`shared/http`): hoje só `/health/*`, `/v1/auth/*` e `/v1/public/*` (chave de API).
- Refresh token em cookie (ADR 0005), via `RefreshTokenCookie` (exportado pelo identity): `HttpOnly`, `SameSite=Strict`, `Path=/v1/auth`, `Secure` fora de dev. Rotas autenticadas por cookie usam `@UseGuards(TrustedOriginGuard)` (CSRF: `Origin` precisa estar em `CORS_ORIGINS`).
- Rate limit (`@nestjs/throttler` + `AppThrottlerGuard`, storage próprio no Redis): padrão 300 req/min por IP **e por rota**; excesso responde 429 `RATE_LIMITED` com `Retry-After`; rotas sensíveis apertam com `@Throttle` (login 10/min com bloqueio de 15 min; cadastro 5/h; refresh 30/min). Sondas de health usam `@SkipThrottle()`. Se o Redis cair, o limite **falha aberto** (log de aviso) em vez de derrubar a API.
- `TRUST_PROXY=true` só atrás do Traefik — senão o cliente forja o IP usado no rate limit.
- `AccessGuard` (accounts, `APP_GUARD`, depois do `JwtAuthGuard`) roda em **toda** rota autenticada: confirma que o vínculo do token está ativo, pertence ao mesmo usuário/tenant e que a conta não está suspensa (senão 401 `AUTH_ACCOUNT_ACCESS_DENIED`), e checa as permissões da rota (senão 403 `AUTH_MISSING_PERMISSION`). A ordem dos guards globais depende da ordem de importação: `SharedInfraModule` → `IdentityModule` → `AccountsModule` no `AppModule`.
- O acesso resolvido (cargo + permissões) fica em cache no Redis por 60 s, por membership (`AccessCache`). **Todo use case que muda cargo, vínculo ou status da conta chama `accessCache.invalidate(...)`.** Sem Redis, o acesso é resolvido no banco (nunca falha aberto).
- **Troca de conta** (`POST /v1/auth/switch-account`, exige access token — o único de `/v1/auth` que não é `@Public` — e origem confiável): abre sessão nova na conta escolhida e **encerra a atual** (`RevokeSessionUseCase`, pelo `sid` do token), gravando o cookie novo. Conta sem vínculo ativo ou suspensa → **403** `ACCOUNT_NOT_ACCESSIBLE` (não 401: a sessão atual continua valendo). "Contas acessíveis" é uma regra só (`findAccessibleAccounts`) para login, lista e troca.
- Logout e reuso de refresh token colocam a sessão numa lista de revogadas no Redis (validade = TTL do access token): o access token dela é recusado na hora. Sem Redis, essa checagem falha aberta (o token vale até expirar).
- `GET /v1/me`: usuário, tenant, `membershipId`, cargo e permissões do ator — o front usa para montar a tela; a API continua checando tudo por conta própria.
- `GET /v1/members/directory`: nomes dos colegas ativos (`membershipId` + nome), aberto a qualquer membro — para "responsável" e remetente das mensagens. Não expõe e-mail, cargo nem status (isso é `/v1/members`, com `members:manage`).
- **Gestão (members, invitations, roles):** o tenant é sempre o do ator (`CurrentAccess`); no accounts os repositórios recebem `tenantId` explícito, que vem só do ator ou de um convite validado.
- **Regra anti-escalada (`assertCanGrant`):** ninguém concede uma permissão que não tem (ao criar/editar cargo, convidar ou trocar cargo) nem administra quem tem permissões além das suas. É o que impede um Admin de criar ou rebaixar um Owner.
- A conta sempre mantém ao menos um Owner ativo; ninguém desativa a si mesmo; o cargo Owner é imutável; `account:manage` é exclusiva do Owner; cargo em uso (membros ou convite pendente) não pode ser excluído.
- Desativar um membro invalida o cache de acesso **e** derruba as sessões dele naquela conta (`IdentityFacade.revokeMembershipSessions`) — sem isso o refresh token continuaria funcionando.
- **Hierarquia de contas (ADR 0009):** `Tenant.parentId` + `ancestors` (caminho da raiz até a mãe, `uuid[]` com índice GIN — "abaixo de X" é `X = ANY(ancestors)`, sem recursão; gravado na criação, a conta não troca de mãe). Uma raiz (`isRoot`), marcada uma vez pelo CLI `node dist/designate-root.js <slug>` (`src/designate-root.ts`), que também pendura nela as contas sem mãe; o cadastro público nasce abaixo dela. **Revendedor** = `allowsChildren` (a raiz sempre): só eles criam contas abaixo (`CHILD_ACCOUNTS_NOT_ALLOWED`); a permissão `accounts:children` (Owner/Admin) diz quem na conta gerencia as de baixo.
  - Rotas `/v1/accounts` (`accounts:children`): `GET children` (subárvore inteira, com `parentName` e `depth`), `POST children` (conta com cargos padrão + convite do dono; devolve `inviteUrl`), `POST children/:id/suspend|reactivate`, `PATCH children/:id { allowsChildren }`. Conta fora da subárvore → 404 `CHILD_ACCOUNT_NOT_FOUND`. `GET parent-accesses` (`members:manage`): quem de cima entrou nesta conta.
  - **Acesso delegado:** a troca de conta para uma conta abaixo (não suspensa) cria/reaproveita um `Membership` com `delegatedFromMembershipId` e o cargo de sistema `parent_access` (criado sob demanda; permissões = `PARENT_ACCESS_PERMISSIONS`, tudo menos `account:manage`, calculadas na resolução) e grava um `ParentAccess`. A origem é o vínculo próprio (não delegado) da pessoa na conta acima **mais próxima**. O `ResolveAccessUseCase` revalida a origem a cada resolução: ativa, não delegada, mesma pessoa, conta acima e não suspensa, com `accounts:children` — senão 401 como qualquer vínculo inválido.
  - O vínculo delegado **não é membro**: some de `/v1/members`, das "contas acessíveis" (login/lista) e não serve de origem para outro; o cargo `parent_access` some de `/v1/roles` e é recusado ao convidar ou trocar cargo (`ROLE_NOT_FOUND`). Aparece no `/v1/members/directory` (assina o que fizer). `/v1/me` devolve `parent` (conta-mãe) e `delegatedFrom` (conta de onde a pessoa veio); o tenant leva `canCreateChildren`.- Convites: token aleatório com só o hash no banco, validade de 7 dias, uso único; convidar de novo o mesmo e-mail substitui o anterior. Sem provedor de e-mail, a criação devolve o `inviteUrl` (`APP_URL/invite/<token>`) para quem convidou repassar. No aceite, quem já tem conta confirma a própria senha; quem não tem cria a conta ali.

- **Chaves de API** (accounts, `/v1/api-keys`, permissão `integrations:manage`): para integrações servidor-a-servidor (formulário do site). Formato `omni_<id>.<segredo>`; no banco só o SHA-256 do segredo e um `hint` (4 primeiros caracteres) — a chave completa aparece uma única vez, na criação. Rotas abertas por chave usam `@ApiKeyAuth()` (= `@Public()` + `ApiKeyGuard`), que aceita `X-Api-Key` ou `Authorization: Bearer` e preenche o tenant com `TenantContext.enter(tenantId)` (não há ator: use cases dessas rotas não usam `ActorContext`/`CurrentAccess`). Chave inválida, revogada ou de conta suspensa: sempre o mesmo 401 `API_KEY_INVALID`. `lastUsedAt` é gravado no máximo a cada 5 min.
- **Entrada de leads** (contacts): `POST /v1/public/leads` (`@ApiKeyAuth`, 60/min) aceita JSON ou form-urlencoded (o `FastifyAdapter` do Nest já faz o parse — **não** registrar `@fastify/formbody`, dá conflito na subida), com nomes de campo em pt/en. Contato já existente (telefone ou e-mail) não é duplicado: só completa campos vazios e mantém a origem original; responde 201 (criado) ou 200 (já existia). Importação CSV em `POST /v1/contacts/import` (`contacts:edit`, multipart com `label` **antes** de `file`): UTF-8 ou windows-1252, `;` ou `,`, até 2.000 linhas; relatório `{ total, created, duplicates, errors: [{ line, code }] }`.

## Tabulações (módulo conversations)

- Catálogo por conta em `/v1/dispositions` (`Disposition`: nome único sem diferenciar maiúsculas, cor de uma paleta fixa, arquivável). Listar é aberto a todo membro (inclui as arquivadas, marcadas); criar/editar/arquivar/excluir exige `dispositions:manage` (Admin e Supervisor por padrão). Só se exclui tabulação **nunca usada** (`DISPOSITION_IN_USE`; a FK do histórico é `Restrict`) — usada, arquiva.
- Tabular: `POST /v1/conversations/:id/dispositions` (quem vê a conversa), com observação opcional (até 1000). Cada tabulação vira um registro imutável em `ConversationDisposition` (histórico em `GET .../dispositions`) e publica `conversation.disposition-set.v1` — é gatilho das automações dos funis.
- A conversa guarda `dispositionId` = tabulação do **atendimento atual**. Como há uma conversa por contato e canal, resolvida → aberta é um atendimento novo: `changeStatus` zera a tabulação (pendente → aberta não).
- **Resolver exige tabulação** quando a conta tem alguma ativa e o atendimento ainda não foi tabulado (`CONVERSATION_DISPOSITION_REQUIRED`, 422). `POST .../status` aceita `disposition` para tabular e resolver na mesma transação. As regras ficam no `ConversationTabulator` (usado pelos dois use cases).
- Nest resolve dependências pelo metadata do TypeScript: parâmetro de construtor precisa do **tipo da classe escrito ali** (não um `type` alias nem `import type`), senão a API nem sobe — e os testes unitários não pegam.

## Funis de vendas (módulo kanban)

- **Card = um NEGÓCIO** (`Deal`, tabela `kanban.deals`): oportunidade de venda de um **contato**, num funil (o "quadro"; as colunas são as **etapas**). Tem título (padrão: nome do contato), valor em centavos (opcional), responsável (`ownerId`, membership; null = fila de leads), situação `open`/`won`/`lost` (motivo da perda opcional) e **conversa opcional** — o lead do formulário entra sem conversa até alguém falar com ele. Um contato pode ter vários negócios, inclusive no mesmo funil.
- Ganho/perdido **sai do funil** (a listagem da etapa e a varredura de tempo parado só veem `open`), continua na ficha do contato e pode ser reaberto (volta à mesma etapa). Negócio fechado não se move (`DEAL_NOT_OPEN`), mas continua "morando" na etapa: excluir a etapa conta e leva os fechados também.
- **Quem vê** (`DealVisibility`, port `DealAccess`): `conversations:view:all` ou `:team` (supervisão) vê todos; `:own` vê os seus, os sem responsável e os das conversas que vê. A conversa só acompanha o negócio se o membro a vê. Negócio que não vê = 404. Rotas: `/v1/deals` (criar — por `contactId` ou `conversationId` —, `GET/PATCH/DELETE /:id`, `POST /:id/move`, `POST /:id/status`, `GET ?contactId=` para a ficha e `?conversationId=` para o chat) e `GET /v1/boards/:id/deals` (em aberto, por etapa). Qualquer escopo de conversas; estrutura do funil exige `boards:manage`.
- `Board` é o agregado com as etapas (até 20, nomes únicos sem diferenciar maiúsculas, mínimo de uma); `Deal` é agregado à parte. Ordem na etapa: `position` fracionária (`positionBetween`), `renumber` quando os vizinhos colam; a API de mover recebe `afterDealId` (o negócio logo acima; null = topo) — nunca índice, porque cada membro vê um subconjunto. Listagem com cursor `(position, id)`, buscando em lotes (até 5) quando há invisíveis.
- Eventos: `kanban.deal.entered-column.v1` (aberto ou movido de etapa, com `movedBy`; gatilho das automações), `kanban.deal.changed.v1` (posição na mesma etapa, edição, responsável, conversa, reaberto, removido) e `kanban.deal.closed.v1` (ganho/perdido, com valor — base dos relatórios de vendas). `enteredColumnAt` reinicia a cada entrada e ao reabrir.
- **Entrada automática** (`DealEntry`, no worker; idempotente): abre um negócio na primeira etapa **a não ser que o contato já tenha um em aberto naquele funil**. Fontes: `conversation.started.v1` nos funis com `autoAdd` `all`/`team` (se o negócio em aberto do contato ainda não tem conversa, ela é **ligada** a ele em vez de abrir outro) e `contact.lead-captured.v1` (publicado pelo contacts a cada envio do formulário, contato novo ou não) nos funis com `autoAddLeads`. Negócio automático nasce sem responsável.
- **Funil padrão:** `tenant.created.v1` cria "Funil de vendas" (Novo, Em contato, Proposta, Fechamento) recebendo conversas novas e leads — só em conta sem nenhum funil. A migration `deals` fez o mesmo para as contas existentes sem funil.
- Excluir etapa com negócios exige `moveTo`: vão em massa para o fim da outra etapa **sem** disparar automações. Excluir o funil leva etapas e negócios (FK do negócio para a etapa é `NoAction`, checada no fim do comando).
- Tempo real: `board.changed { boardId, contactId? }` para as salas de escopo de conversas; o front recarrega o funil e os negócios fora dele (ficha, chat). `conversation.changed` recarrega os negócios (não lidas, prévia).
- A migration `20261016180000_deals` renomeou `board_cards` → `deals` à mão (o `migrate diff` trataria como apagar e criar). Ela **não** é compatível com a versão anterior do código — valeu porque nenhuma versão tinha sido publicada; depois do primeiro deploy, mudanças assim precisam de duas etapas.

## Automações dos funis

- Regra (`AutomationRule`) pertence a uma etapa; gerenciar exige `boards:manage` (`/v1/boards/:id/automations`, até 10 por etapa). Gatilhos (os nomes `card_*` ficaram por compatibilidade): `card_entered` (ações: mensagem, atribuir), `card_idle` (minutos, 1 min–90 dias; ações: mensagem, atribuir, **mover**) e eventos da conversa que **movem os negócios em aberto dela para a etapa da regra** (`disposition_set`, `conversation_resolved`, `customer_replied`), em cada funil (várias regras no mesmo funil: vale a etapa mais à esquerda).
- **Negócio sem conversa:** "enviar mensagem" é pulada (`DEAL_WITHOUT_CONVERSATION`, registrada na execução). "Atribuir" com pessoa torna-a **responsável pelo negócio** e, se houver conversa, também por ela; equipe só vale para a conversa.
- **Entrada nunca move** (evita laço instantâneo entre colunas); só o tempo parado move, no máximo uma vez por entrada.
- **Cada disparo roda uma vez só:** `AutomationRun` com `(ruleId, dedupeKey)` único é gravado ANTES de agir (evento: `eventId` da entrega; tempo parado: `dealId:enteredColumnAt` — a mesma chave no SQL de `dueIdleDeals` e em `idleDedupeKey`). Evento repetido/retry não reenvia mensagem ao cliente; se o processo cair no meio, o disparo fica `running` e não é refeito (preferimos não enviar a enviar duas vezes). Uma ação que falha não impede as seguintes; o resultado de cada uma fica na execução (`GET .../automations/:id/runs`).
- **Tempo parado conta a partir da ativação da regra** (`activeSince`: criação, reativação ou troca de gatilho) — regra nova não dispara em massa para negócios parados há meses.
- Varredura: agendador do BullMQ (`upsertJobScheduler`, único no Redis, a cada 60 s) na fila `kanban-automations`, registrado pelo `KanbanWorkerModule` (só no worker). A varredura lê as regras de todas as contas (`listEnabledIdleAllTenants`, sem filtro de tenant de propósito) e enfileira um job por regra **no tenant dela** (`TenantContext.enter`), com id por minuto.
- Ações nas conversas passam por métodos `…AsSystem` da `ConversationsFacade` (sem membro: só o tenant limita; nunca chamar de uma requisição HTTP). Mensagem automática: `Message.automated` (`automated: true`, sem remetente), aparece como "Automação" no chat; texto com `{{nome}}`/`{{nome_completo}}` (`renderTemplate` arruma a pontuação sem nome). Atribuir usa as mesmas regras da transferência (`applyTransfer`).
- Excluir etapa apaga as regras dela (FK) e as que movem negócios para ela; os negócios movidos em massa não disparam automações.

## E-mail e SMS (módulo messaging)

- **Cada conta usa as próprias credenciais** (`messaging:manage`, Admin por padrão; `/v1/messaging/providers`): e-mail pelo **SendGrid** (API key com "Mail Send" + remetente verificado) e SMS pela **Twilio** (Account SID + Auth Token + número OU Messaging Service). Um provedor por canal por conta.
- Segredos cifrados com o port compartilhado `SecretCipher` (`SecretBoxCipher`: AES-256-GCM, `ENCRYPTION_KEY`); a API nunca devolve o segredo, só os 4 últimos caracteres. Atualizar sem mandar o segredo mantém o salvo; mudar a configuração volta o status para `unverified`.
- Clientes HTTP (`SendGridClient`, `TwilioSmsClient`) com tempo limite de 10 s e erro classificado: 4xx → `ProviderRejectedError` (não repetir; guarda a mensagem do provedor), 429/5xx/rede → `ProviderUnavailableError` (vale repetir). URLs em `SENDGRID_API_URL`/`TWILIO_API_URL` (padrão: as reais) — só mudam em testes, para um servidor falso. Provedor novo de SMS: cliente que implementa `SmsProviderClient` + entrada no `ProviderClientsRegistry` + tipo em `SmsSettings`.
- **Envio de teste é síncrono** (exceção consciente ao "externo vai para fila": quem configura precisa da resposta na tela); guarda o resultado (`verified`/`failing` + mensagem do provedor). Destino inválido não muda o status. Limitado a 10/min.

- **Envio pela ficha do contato** (`POST /v1/messaging/contacts/:id/messages`, `messaging:send` — Admin/Supervisor/Agent por padrão): grava `OutboundMessage` (`queued`) e enfileira `DeliverOutboundJob` (fila `messaging`, só no worker via `MessagingWorkerModule`). Recusa do provedor → `failed` com o motivo dele; indisponível → continua `queued` com o motivo e a fila repete; esgotou as tentativas → `GiveUpOutboundMessageUseCase` (gancho `failed` do worker, via `TenantAwareProcessor.inJobContext`). Só entrega mensagens `queued` (job repetido não reenvia).
- **Status só avança** (`queued → sent → delivered`; `failed`/`bounced` finais; `bounced` pode vir depois de `delivered`): avisos fora de ordem ou repetidos não regridem. **O nosso id vai junto do envio** para achar a mensagem nos avisos: `custom_args.omni_message_id` (SendGrid) e `?m=<id>` no StatusCallback (Twilio — a assinatura cobre a URL inteira).
- **Webhooks** (`/v1/public/webhooks/...`, `@Public`): acham o provedor pelo id da URL (`findByIdAsSystem`, sem tenant), **conferem a assinatura com as credenciais dele** (Twilio: HMAC-SHA1 do Auth Token sobre `PUBLIC_API_URL + request.url` + params ordenados; SendGrid: ECDSA sobre timestamp + corpo cru — `rawBody: true` no `main.ts` — com a Verification Key que o cliente cola na configuração; sem ela, os eventos são recusados), entram no tenant e **enfileiram** (resposta rápida). StatusCallback só é pedido se `PUBLIC_API_URL` for https público.
- **Descadastro** (`OptOut` por canal + endereço; bloqueia envio e entrega): link assinado no rodapé de todo e-mail (`HmacUnsubscribeTokens`, chave derivada da `ENCRYPTION_KEY`, sem expirar) + cabeçalhos `List-Unsubscribe`/`List-Unsubscribe-Post` (RFC 8058, um clique no Gmail/Outlook). **GET só mostra a página; quem descadastra é o POST** (antivírus de e-mail abrem links). Também: resposta "SAIR/PARAR/STOP…" por SMS (webhook de entrada da Twilio) e eventos `unsubscribe`/`spamreport` do SendGrid. Reativar exige `messaging:manage` (só a pedido do contato).
- O token do descadastro passa de 100 caracteres: o `FastifyAdapter` usa `maxParamLength: 1000` (o padrão recusaria o link).

### Campanhas

- `Campaign` (`campaigns:manage`, Admin/Supervisor por padrão; `/v1/campaigns`): um canal, texto com `{{nome}}`/`{{nome_completo}}` (`shared/domain/message-template.ts`, o mesmo das automações), assunto obrigatório no e-mail, e **público por filtros de contato** (`search`, `source`, `sourceDetail` — o lote da importação), lidos pelo `ContactsFacade.audiencePage`. Estados: rascunho → agendada → enviando → enviada; cancelada. Só se edita rascunho/agendada; só se exclui rascunho.
- **Agendar** exige o provedor do canal configurado; `at: null` = agora (enfileira `MaterializeCampaignJob` com jobId `campaign:<id>`). As agendadas são iniciadas pela **varredura por minuto** (`CampaignSweepJob`, `upsertJobScheduler` no `MessagingScheduler`, só no worker), que entra no tenant de cada uma.
- **Montagem do público** em lotes de 500, retomável: o cursor fica na campanha e `@@unique([campaignId, contactId])` impede mensagem duplicada; ao retomar, reenfileira as `queued` já gravadas. Pula quem não tem endereço ou está descadastrado (contadores na campanha). O texto é truncado **depois** de personalizar. SMS de campanha leva o rodapé `SMS_OPT_OUT_FOOTER` ("responda SAIR").
- **Ritmo**: cada mensagem é um `DeliverOutboundJob` com `delayMs` pela posição (`CAMPAIGN_RATE_PER_SECOND`: SMS 1/s — limite de número longo da Twilio —, e-mail 20/s). Por isso "enviada" significa "público montado": ainda pode haver mensagens na fila, e **cancelar vale até a última sair** (a entrega recusa com `CAMPAIGN_CANCELED`).
- Relatório: contagem por status das mensagens + destinatários (`/:id/recipients`).

## Testes em execução (API + worker de teste)

- Com o worker de dev rodando, uma API/worker de teste no **mesmo banco** disputa os eventos do outbox com ele. Para testes de ponta a ponta com o worker, suba a API/worker de teste apontando para o ambiente de e2e (banco `<nome>_e2e`, Redis db 1, `QUEUE_PREFIX=omni-e2e`) — e pare-os antes do `npm run test:e2e`, que usa as mesmas filas.

## Convenções de nomes

- Arquivos em kebab-case com sufixo do papel: `.entity.ts`, `.vo.ts`, `.event.ts`, `.error.ts`, `.use-case.ts`, `.input.ts`, `.facade.ts`, `.repository.ts` (port), `prisma-*.repository.ts` / `in-memory-*.repository.ts` (adapters), `.mapper.ts`, `.controller.ts`, `.presenter.ts`, `.gateway.ts`, `.dto.ts`, `.query.ts`, `.processor.ts`, `.handler.ts`, `.spec.ts`.
- Eventos expõem o nome também como estático (`ContactCreatedEvent.eventName`), para uso em `@OnEvent(...)` sem string solta.
- Classes em PascalCase com o mesmo sufixo (`SendMessageUseCase`, `PrismaConversationRepository`).

## Testes

- `domain/`: testes unitários puros, sem Nest.
- Use cases: unitários com fakes dos ports, sem banco e sem Nest (instanciados com `new`). Fakes do shared kernel em `shared/testing/fakes.ts`; repositório em memória do módulo em `<modulo>/testing/`, reproduzindo o contrato do real (isolamento por tenant, unicidade, ordem).
- Todo módulo tenant-aware tem teste provando que um tenant não enxerga dados de outro (`FakeTenantContext.switchTo`).
- `test/e2e/modules.e2e-spec.ts` compila o container de injeção **completo** da API e do worker: pega provider sem registro, fila não registrada no módulo que a injeta (cada módulo que usa `@InjectQueue` registra a fila) e tipo de construtor que o Nest não resolve.
- Integração em `test/e2e/*.e2e-spec.ts`: repositórios, outbox, filas. Usa o Postgres e o Redis do Docker, mas **isolados do dev** (`test/e2e/e2e-env.ts`): banco `omnichannel_e2e` (criado e migrado pelo `global-setup.ts` a cada execução), Redis db 1 e filas `omni-e2e`. Pode rodar com o `npm run dev` de pé. Dados de teste com ids/e-mails próprios (`@teste.dev`), limpos no `afterAll`.
- O `dist` é compartilhado por API e worker no watch: por isso `deleteOutDir: false` no nest-cli e a limpeza fica no `prebuild` (dist + tsbuildinfo).
- Todo use case novo vem com `.spec.ts`.

## Criando um módulo novo

1. `src/modules/<modulo>/` com as quatro camadas e o `index.ts` (use `contacts` como modelo).
2. `prisma/schema/<modulo>.prisma` com `@@schema("<modulo>")`; adicionar o schema à lista `schemas` em `base.prisma`; `npm run prisma:migrate -- --name <nome>`.
3. Registrar o módulo em `app.module.ts` importando do `index.ts` (e o `.worker.module.ts` em `worker.module.ts`, se houver).
4. Rodar `npm run lint` e `npm test` — as fronteiras já cobrem o módulo novo.
