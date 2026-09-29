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
- `accounts` — tenants, memberships, roles, convites, catálogo de permissões e cargos padrão. Rotas: `/v1/auth/signup` e `/v1/auth/login` (envolvem tenants), `/v1/me`, `/v1/members`, `/v1/invitations` (+ `lookup` e `accept`, públicas) e `/v1/roles`. Depende de `identity`, **nunca o contrário**.
- `contacts` — contatos (leads) e notas internas. Rotas `/v1/contacts` (`contacts:view`; escrita `contacts:edit`): listar com busca `q` (nome, e-mail ou dígitos do telefone) e filtro `source`, criar, `GET/PATCH /:id`, `GET/POST /:id/notes`, `DELETE /:id/notes/:noteId`.
  - **Origem do lead** (`domain/lead-source.ts`): `whatsapp` (criado pela primeira mensagem, via `ContactsFacade.findOrCreateByPhone`), `manual`, `import`, `web_form`, + `sourceDetail` livre (campanha, página). A origem **não é editável** (é histórico); a edição mexe só em nome, telefone e e-mail, com as mesmas regras da criação.
  - **Notas:** o autor é o membro autenticado (`ActorContext`), nunca um id do cliente; só o autor apaga. O histórico de atendimentos da ficha vem do módulo conversations (`GET /v1/conversations?contactId=`), respeitando o escopo de quem consulta.
- `channels` — canais de atendimento (hoje WhatsApp via Baileys; depois API oficial). Rotas `/v1/channels` (permissão `channels:manage`): listar, criar, `GET /:id/connection` (status + QR), `connect`, `disconnect`, `test-message`, `PATCH /:id/team` (equipe que recebe as conversas novas) e `DELETE /:id`. Não fala com o WhatsApp: enfileira comandos para o conector e aplica os relatos dele (worker).
- `conversations` — conversas e mensagens. **Uma conversa por (canal, contato)**, status `open`/`pending`/`resolved` (mensagem do cliente reabre). Entrada pelo evento `channel.message.received.v1` (worker): acha/cria o contato pelo telefone (`ContactsFacade`), acha/abre a conversa e grava a mensagem — idempotente pelo `externalId` (único por canal). Resposta: `POST /v1/conversations/:id/messages` grava `pending` e enfileira via `ChannelsFacade` **depois** do commit; o resultado chega por `channel.message.send-result.v1`. Quem responde uma conversa sem responsável a assume. Rotas: `GET /v1/conversations` (cursor opaco, ordem da última mensagem), `GET /:id`, `GET /:id/messages`, `POST /:id/messages`, `POST /:id/status`, `POST /:id/read`. Publica `conversation.message.added.v1`, `conversation.message.status-changed.v1`, `conversation.status-changed.v1` e `conversation.assigned.v1`.
  - **Escopo (`VisibleConversations` + `domain/visibility.ts`):** `view:all` vê tudo; `view:team` (supervisão) vê todas as conversas das suas equipes, as atribuídas a ele e a fila geral; `view:own` (atendimento) vê as atribuídas a ele e a **fila** — sem responsável, das suas equipes ou sem equipe. Conversa fora do escopo responde 404. A consulta Prisma (`scopeFilter`) e as salas do tempo real (`audience`) espelham a mesma regra: mudou uma, mude as três.
  - **Equipe da conversa:** herdada da equipe do canal ao abrir; muda por transferência. Sem equipe = fila geral.
  - **Atribuição:** `POST /:id/claim` (qualquer escopo; só conversa sem responsável — senão 409) e `POST /:id/transfer` (`conversations:assign`; `{ teamId?, assigneeId? }`, ausente = não muda, `null` = tira; mudar só a equipe devolve para a fila dela). Responder uma conversa sem responsável também a assume. Filtros da lista: `assignee=me|none` e `contactId` (histórico na ficha do contato).
  - Contatos só com LID (sem telefone) ainda são ignorados na entrada (log de aviso).
- `teams` — equipes de atendimento (ADR 0003: o cargo define o quê; a equipe, sobre quais dados). Rotas `/v1/teams`: listar (`teams:manage` ou `conversations:assign`), criar, renomear, `PUT /:id/members` (só membros ativos) e excluir (`teams:manage`). Excluir publica `team.deleted.v1`: channels e conversations limpam o `teamId` (voltam à fila geral). `TeamsFacade` dá as equipes de um membro (escopo e salas).
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
- Logout e reuso de refresh token colocam a sessão numa lista de revogadas no Redis (validade = TTL do access token): o access token dela é recusado na hora. Sem Redis, essa checagem falha aberta (o token vale até expirar).
- `GET /v1/me`: usuário, tenant, `membershipId`, cargo e permissões do ator — o front usa para montar a tela; a API continua checando tudo por conta própria.
- `GET /v1/members/directory`: nomes dos colegas ativos (`membershipId` + nome), aberto a qualquer membro — para "responsável" e remetente das mensagens. Não expõe e-mail, cargo nem status (isso é `/v1/members`, com `members:manage`).
- **Gestão (members, invitations, roles):** o tenant é sempre o do ator (`CurrentAccess`); no accounts os repositórios recebem `tenantId` explícito, que vem só do ator ou de um convite validado.
- **Regra anti-escalada (`assertCanGrant`):** ninguém concede uma permissão que não tem (ao criar/editar cargo, convidar ou trocar cargo) nem administra quem tem permissões além das suas. É o que impede um Admin de criar ou rebaixar um Owner.
- A conta sempre mantém ao menos um Owner ativo; ninguém desativa a si mesmo; o cargo Owner é imutável; `account:manage` é exclusiva do Owner; cargo em uso (membros ou convite pendente) não pode ser excluído.
- Desativar um membro invalida o cache de acesso **e** derruba as sessões dele naquela conta (`IdentityFacade.revokeMembershipSessions`) — sem isso o refresh token continuaria funcionando.
- Convites: token aleatório com só o hash no banco, validade de 7 dias, uso único; convidar de novo o mesmo e-mail substitui o anterior. Sem provedor de e-mail, a criação devolve o `inviteUrl` (`APP_URL/invite/<token>`) para quem convidou repassar. No aceite, quem já tem conta confirma a própria senha; quem não tem cria a conta ali.

- **Chaves de API** (accounts, `/v1/api-keys`, permissão `integrations:manage`): para integrações servidor-a-servidor (formulário do site). Formato `omni_<id>.<segredo>`; no banco só o SHA-256 do segredo e um `hint` (4 primeiros caracteres) — a chave completa aparece uma única vez, na criação. Rotas abertas por chave usam `@ApiKeyAuth()` (= `@Public()` + `ApiKeyGuard`), que aceita `X-Api-Key` ou `Authorization: Bearer` e preenche o tenant com `TenantContext.enter(tenantId)` (não há ator: use cases dessas rotas não usam `ActorContext`/`CurrentAccess`). Chave inválida, revogada ou de conta suspensa: sempre o mesmo 401 `API_KEY_INVALID`. `lastUsedAt` é gravado no máximo a cada 5 min.
- **Entrada de leads** (contacts): `POST /v1/public/leads` (`@ApiKeyAuth`, 60/min) aceita JSON ou form-urlencoded (o `FastifyAdapter` do Nest já faz o parse — **não** registrar `@fastify/formbody`, dá conflito na subida), com nomes de campo em pt/en. Contato já existente (telefone ou e-mail) não é duplicado: só completa campos vazios e mantém a origem original; responde 201 (criado) ou 200 (já existia). Importação CSV em `POST /v1/contacts/import` (`contacts:edit`, multipart com `label` **antes** de `file`): UTF-8 ou windows-1252, `;` ou `,`, até 2.000 linhas; relatório `{ total, created, duplicates, errors: [{ line, code }] }`.

## Tabulações (módulo conversations)

- Catálogo por conta em `/v1/dispositions` (`Disposition`: nome único sem diferenciar maiúsculas, cor de uma paleta fixa, arquivável). Listar é aberto a todo membro (inclui as arquivadas, marcadas); criar/editar/arquivar/excluir exige `dispositions:manage` (Admin e Supervisor por padrão). Só se exclui tabulação **nunca usada** (`DISPOSITION_IN_USE`; a FK do histórico é `Restrict`) — usada, arquiva.
- Tabular: `POST /v1/conversations/:id/dispositions` (quem vê a conversa), com observação opcional (até 1000). Cada tabulação vira um registro imutável em `ConversationDisposition` (histórico em `GET .../dispositions`) e publica `conversation.disposition-set.v1` — é o gatilho das automações do kanban.
- A conversa guarda `dispositionId` = tabulação do **atendimento atual**. Como há uma conversa por contato e canal, resolvida → aberta é um atendimento novo: `changeStatus` zera a tabulação (pendente → aberta não).
- **Resolver exige tabulação** quando a conta tem alguma ativa e o atendimento ainda não foi tabulado (`CONVERSATION_DISPOSITION_REQUIRED`, 422). `POST .../status` aceita `disposition` para tabular e resolver na mesma transação. As regras ficam no `ConversationTabulator` (usado pelos dois use cases).
- Nest resolve dependências pelo metadata do TypeScript: parâmetro de construtor precisa do **tipo da classe escrito ali** (não um `type` alias nem `import type`), senão a API nem sobe — e os testes unitários não pegam.

## Kanban (módulo kanban)

- **Card = uma conversa (atendimento)**, no máximo uma vez por quadro; a mesma conversa pode estar em vários quadros. O módulo guarda só o `conversationId` e lê as conversas pela `ConversationsFacade` (`visibleSummaries`/`isVisible`), **sempre no escopo do membro**: o agente só vê (e só move) cards de conversas que vê na caixa de entrada. Card de conversa invisível responde 404.
- `Board` é o agregado com as colunas (até 20, nomes únicos sem diferenciar maiúsculas, mínimo de uma); `BoardCard` é agregado à parte. Estrutura do quadro exige `boards:manage` (Admin e Supervisor por padrão); ver e mover cards, qualquer escopo de conversas.
- Ordem na coluna: `position` fracionária (`positionBetween`): mover entre dois cards não renumera a coluna; quando os vizinhos ficam colados demais, o use case chama `renumber` (SQL em massa) e recalcula. A API de mover recebe `afterCardId` (o card logo acima no destino; null = topo) — nunca um índice, porque cada membro vê um subconjunto dos cards.
- Listagem por coluna com cursor `(position, id)`; como cards invisíveis são filtrados depois de buscar, o use case busca em lotes (até 5) para completar a página.
- `kanban.card.entered-column.v1` a cada entrada numa coluna (adicionado, movido de outra coluna, entrada automática) com `movedBy` (null = sistema) — gatilho das automações. Reordenar na mesma coluna só gera `repositioned` (tempo real). `enteredColumnAt` reinicia a cada entrada ("parado há X").
- **Entrada automática** por quadro (`none`/`all`/`team`): o `KanbanAutoAddHandler` (worker) reage a `conversation.started.v1` e põe o card no topo da primeira coluna, idempotente. Equipe excluída desliga a entrada por equipe.
- Excluir coluna com cards exige `moveTo`: os cards vão em massa para o fim da outra coluna **sem** disparar automações. Excluir o quadro leva colunas e cards (FK do card para a coluna é `NoAction`: checada no fim do comando, então a cascata do quadro passa, mas apagar só a coluna com cards falha).
- Tempo real: `board.changed { boardId }` para as salas de escopo de conversas do tenant; o front também recarrega os cards a cada `conversation.changed` (o card mostra dados da conversa).

## Automações do kanban

- Regra (`AutomationRule`) pertence a uma coluna; gerenciar exige `boards:manage` (`/v1/boards/:id/automations`, até 10 por coluna). Gatilhos: `card_entered` (ações: mensagem, atribuir), `card_idle` (minutos, 1 min–90 dias; ações: mensagem, atribuir, **mover**) e eventos da conversa que **movem o card para a coluna da regra** (`disposition_set`, `conversation_resolved`, `customer_replied`), em todo quadro em que a conversa estiver (várias regras no mesmo quadro: vale a coluna mais à esquerda).
- **Entrada nunca move** (evita laço instantâneo entre colunas); só o tempo parado move, no máximo uma vez por entrada.
- **Cada disparo roda uma vez só:** `AutomationRun` com `(ruleId, dedupeKey)` único é gravado ANTES de agir (evento: `eventId` da entrega; tempo parado: `cardId:enteredColumnAt` — a mesma chave no SQL de `dueIdleCards` e em `idleDedupeKey`). Evento repetido/retry não reenvia mensagem ao cliente; se o processo cair no meio, o disparo fica `running` e não é refeito (preferimos não enviar a enviar duas vezes). Uma ação que falha não impede as seguintes; o resultado de cada uma fica na execução (`GET .../automations/:id/runs`).
- **Tempo parado conta a partir da ativação da regra** (`activeSince`: criação, reativação ou troca de gatilho) — regra nova não dispara em massa para cards parados há meses.
- Varredura: agendador do BullMQ (`upsertJobScheduler`, único no Redis, a cada 60 s) na fila `kanban-automations`, registrado pelo `KanbanWorkerModule` (só no worker). A varredura lê as regras de todas as contas (`listEnabledIdleAllTenants`, sem filtro de tenant de propósito) e enfileira um job por regra **no tenant dela** (`TenantContext.enter`), com id por minuto.
- Ações nas conversas passam por métodos `…AsSystem` da `ConversationsFacade` (sem membro: só o tenant limita; nunca chamar de uma requisição HTTP). Mensagem automática: `Message.automated` (`automated: true`, sem remetente), aparece como "Automação" no chat; texto com `{{nome}}`/`{{nome_completo}}` (`renderTemplate` arruma a pontuação sem nome). Atribuir usa as mesmas regras da transferência (`applyTransfer`).
- Excluir coluna apaga as regras dela (FK) e as que movem cards para ela; os cards movidos em massa não disparam automações.

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
- Integração em `test/e2e/*.e2e-spec.ts`: repositórios, outbox, filas. Usa o Postgres e o Redis do Docker, mas **isolados do dev** (`test/e2e/e2e-env.ts`): banco `omnichannel_e2e` (criado e migrado pelo `global-setup.ts` a cada execução), Redis db 1 e filas `omni-e2e`. Pode rodar com o `npm run dev` de pé. Dados de teste com ids/e-mails próprios (`@teste.dev`), limpos no `afterAll`.
- O `dist` é compartilhado por API e worker no watch: por isso `deleteOutDir: false` no nest-cli e a limpeza fica no `prebuild` (dist + tsbuildinfo).
- Todo use case novo vem com `.spec.ts`.

## Criando um módulo novo

1. `src/modules/<modulo>/` com as quatro camadas e o `index.ts` (use `contacts` como modelo).
2. `prisma/schema/<modulo>.prisma` com `@@schema("<modulo>")`; adicionar o schema à lista `schemas` em `base.prisma`; `npm run prisma:migrate -- --name <nome>`.
3. Registrar o módulo em `app.module.ts` importando do `index.ts` (e o `.worker.module.ts` em `worker.module.ts`, se houver).
4. Rodar `npm run lint` e `npm test` — as fronteiras já cobrem o módulo novo.
