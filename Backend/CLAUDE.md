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
npm run dev                # API + worker em watch mode (um terminal, saída prefixada)
npm run start:dev          # só a API
npm run start:worker:dev   # só o worker
npm run build
npm run lint               # inclui a checagem de fronteiras entre módulos
npm run format             # Prettier (aspas simples, trailing comma, 100 colunas)
npm test                   # unitários (test:watch, test:cov)
npm run test:e2e           # integração contra Postgres/Redis do Docker (test/e2e)
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
- `accounts` — tenants, memberships, roles, convites, catálogo de permissões e cargos padrão. Rotas: `/v1/auth/signup` e `/v1/auth/login` (envolvem tenants), `/v1/me`, `/v1/members`, `/v1/invitations` (+ `lookup` e `accept`, públicas) e `/v1/roles`. Depende de `identity`, **nunca o contrário**.
- `contacts`
- `channels` — integração com provedores e webhooks
- `conversations`
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

## Eventos, filas e worker

- **Três processos, a mesma imagem:** `api` (`main.ts`), `worker` (`worker.ts`, sem HTTP — só health check em `WORKER_HEALTH_PORT`) e, a partir do módulo channels, `whatsapp-connector` (ADR 0006).
- **Eventos de domínio usam outbox:** `EventBus.publish` grava o evento em `platform.outbox_events` **na mesma transação** dos dados (o use case deve usar `UnitOfWork`). O `OutboxRelay` (worker) lê os pendentes a cada segundo e cria **um job por consumidor** na fila `domain-events` (id estável `<evento>:<consumidor>`), com retry exponencial.
- **Consumir um evento:** método num provider do módulo (`application/event-handlers/`), marcado com `@HandlesDomainEvent(OutroModuloEvent)`, recebendo `DeliveredEvent<E>` (dados do evento + `eventId`). Roda no worker, no tenant do evento. Entrega é "ao menos uma vez": **todo consumidor é idempotente** (use o `eventId`).
- Evento de módulo multi-tenant carrega `tenantId` (o do evento prevalece sobre o do contexto). Contrato público e versionado (`message.received.v1`), em `domain/events/`, exportado no `index.ts`.
- **Jobs:** declare com `defineJob<Payload>('<fila>', '<nome>')` e enfileire pelo port `JobQueue` (`JOB_QUEUE`) — sem importar BullMQ na application. Tenant e correlation id seguem no envelope do job automaticamente. `jobId` estável = dedup (ex.: id externo da mensagem); `:` no id é trocado pelo adapter.
- **Processar:** processor em `infra/` que estende `TenantAwareProcessor` (restaura tenant e correlation id), registrado num `<modulo>.worker.module.ts` importado **só** pelo `WorkerModule`; a fila é registrada no módulo com `BullModule.registerQueue`.
- Todo processor é **idempotente** e usa retry com backoff (padrão: 5 tentativas).
- Webhooks de canais: o controller valida a assinatura, enfileira o payload bruto e responde 200. O processamento acontece no worker.
- `QUEUE_PREFIX` separa as filas por ambiente (os testes e2e usam `omni-e2e`).

## Logs e correlation id

- Pino (`nestjs-pino`): JSON em produção, legível em dev. Use o `Logger` do `@nestjs/common` (`new Logger(Classe.name)`); nunca `console.log`.
- Toda linha leva `correlationId` e, quando houver, `tenantId`. O correlation id é o `X-Request-Id` recebido (se válido) ou um novo — definido pelo `genReqId` do Fastify —, devolvido no header da resposta e propagado aos jobs e eventos gerados: uma operação é rastreável da requisição até o worker.
- Nunca logar senha, tokens, cookies ou payloads com dados pessoais (o `redact` do logger cobre headers e campos comuns — não confie só nele).

## HTTP

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
- WebSocket: token validado na conexão; eventos emitidos só para a sala do tenant.
- Índices de tabelas de negócio começam pelo `tenantId`.
- Access token (JWT HS256, `JWT_SECRET`, 15 min) contém só `sub` (user), `tid` (tenant), `mid` (membership) e `sid` (sessão); permissões são resolvidas por requisição (cache Redis).
- Refresh token = `<sessionId>.<segredo>`; no banco fica só o SHA-256 do segredo. Rotação a cada uso; reuso de um segredo antigo revoga a sessão inteira.
- Senhas: Argon2id (`@node-rs/argon2`), atrás do port `PasswordHasher`. A senha em texto puro só existe no value object `Password` (que não se serializa).
- `JwtAuthGuard` (identity, `APP_GUARD`) valida o `Authorization: Bearer` e grava o ator no `ActorContext` (CLS); `TenantContext` lê o tenant dele. Rotas abertas usam `@Public()` (`shared/http`): hoje só `/health/*` e `/v1/auth/*`.
- Refresh token em cookie (ADR 0005), via `RefreshTokenCookie` (exportado pelo identity): `HttpOnly`, `SameSite=Strict`, `Path=/v1/auth`, `Secure` fora de dev. Rotas autenticadas por cookie usam `@UseGuards(TrustedOriginGuard)` (CSRF: `Origin` precisa estar em `CORS_ORIGINS`).
- Rate limit (`@nestjs/throttler` + `AppThrottlerGuard`, storage próprio no Redis): padrão 300 req/min por IP **e por rota**; excesso responde 429 `RATE_LIMITED` com `Retry-After`; rotas sensíveis apertam com `@Throttle` (login 10/min com bloqueio de 15 min; cadastro 5/h; refresh 30/min). Sondas de health usam `@SkipThrottle()`. Se o Redis cair, o limite **falha aberto** (log de aviso) em vez de derrubar a API.
- `TRUST_PROXY=true` só atrás do Traefik — senão o cliente forja o IP usado no rate limit.
- `AccessGuard` (accounts, `APP_GUARD`, depois do `JwtAuthGuard`) roda em **toda** rota autenticada: confirma que o vínculo do token está ativo, pertence ao mesmo usuário/tenant e que a conta não está suspensa (senão 401 `AUTH_ACCOUNT_ACCESS_DENIED`), e checa as permissões da rota (senão 403 `AUTH_MISSING_PERMISSION`). A ordem dos guards globais depende da ordem de importação: `SharedInfraModule` → `IdentityModule` → `AccountsModule` no `AppModule`.
- O acesso resolvido (cargo + permissões) fica em cache no Redis por 60 s, por membership (`AccessCache`). **Todo use case que muda cargo, vínculo ou status da conta chama `accessCache.invalidate(...)`.** Sem Redis, o acesso é resolvido no banco (nunca falha aberto).
- Logout e reuso de refresh token colocam a sessão numa lista de revogadas no Redis (validade = TTL do access token): o access token dela é recusado na hora. Sem Redis, essa checagem falha aberta (o token vale até expirar).
- `GET /v1/me`: usuário, tenant, cargo e permissões do ator — o front usa para montar a tela; a API continua checando tudo por conta própria.
- **Gestão (members, invitations, roles):** o tenant é sempre o do ator (`CurrentAccess`); no accounts os repositórios recebem `tenantId` explícito, que vem só do ator ou de um convite validado.
- **Regra anti-escalada (`assertCanGrant`):** ninguém concede uma permissão que não tem (ao criar/editar cargo, convidar ou trocar cargo) nem administra quem tem permissões além das suas. É o que impede um Admin de criar ou rebaixar um Owner.
- A conta sempre mantém ao menos um Owner ativo; ninguém desativa a si mesmo; o cargo Owner é imutável; `account:manage` é exclusiva do Owner; cargo em uso (membros ou convite pendente) não pode ser excluído.
- Desativar um membro invalida o cache de acesso **e** derruba as sessões dele naquela conta (`IdentityFacade.revokeMembershipSessions`) — sem isso o refresh token continuaria funcionando.
- Convites: token aleatório com só o hash no banco, validade de 7 dias, uso único; convidar de novo o mesmo e-mail substitui o anterior. Sem provedor de e-mail, a criação devolve o `inviteUrl` (`APP_URL/invite/<token>`) para quem convidou repassar. No aceite, quem já tem conta confirma a própria senha; quem não tem cria a conta ali.

## Convenções de nomes

- Arquivos em kebab-case com sufixo do papel: `.entity.ts`, `.vo.ts`, `.event.ts`, `.error.ts`, `.use-case.ts`, `.input.ts`, `.facade.ts`, `.repository.ts` (port), `prisma-*.repository.ts` / `in-memory-*.repository.ts` (adapters), `.mapper.ts`, `.controller.ts`, `.presenter.ts`, `.gateway.ts`, `.dto.ts`, `.query.ts`, `.processor.ts`, `.handler.ts`, `.spec.ts`.
- Eventos expõem o nome também como estático (`ContactCreatedEvent.eventName`), para uso em `@OnEvent(...)` sem string solta.
- Classes em PascalCase com o mesmo sufixo (`SendMessageUseCase`, `PrismaConversationRepository`).

## Testes

- `domain/`: testes unitários puros, sem Nest.
- Use cases: unitários com fakes dos ports, sem banco e sem Nest (instanciados com `new`). Fakes do shared kernel em `shared/testing/fakes.ts`; repositório em memória do módulo em `<modulo>/testing/`, reproduzindo o contrato do real (isolamento por tenant, unicidade, ordem).
- Todo módulo tenant-aware tem teste provando que um tenant não enxerga dados de outro (`FakeTenantContext.switchTo`).
- Integração em `test/e2e/*.e2e-spec.ts` (Postgres e Redis reais do Docker, filas em prefixo próprio): repositórios, outbox, filas. Dados de teste com ids/e-mails próprios (`@teste.dev`), limpos no `afterAll`.
- O `dist` é compartilhado por API e worker no watch: por isso `deleteOutDir: false` no nest-cli e a limpeza fica no `prebuild` (dist + tsbuildinfo).
- Todo use case novo vem com `.spec.ts`.

## Criando um módulo novo

1. `src/modules/<modulo>/` com as quatro camadas e o `index.ts` (use `contacts` como modelo).
2. `prisma/schema/<modulo>.prisma` com `@@schema("<modulo>")`; adicionar o schema à lista `schemas` em `base.prisma`; `npm run prisma:migrate -- --name <nome>`.
3. Registrar o módulo em `app.module.ts` importando do `index.ts` (e o `.worker.module.ts` em `worker.module.ts`, se houver).
4. Rodar `npm run lint` e `npm test` — as fronteiras já cobrem o módulo novo.
