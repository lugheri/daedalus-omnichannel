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
- BullMQ (`@nestjs/bullmq`) + Redis para filas
- Socket.IO com Redis adapter para tempo real
- `nestjs-cls` + `@nestjs-cls/transactional` (adapter Prisma) para contexto por requisição (tenant), transações e correlation ID
- `@nestjs/event-emitter` como base do event bus em memória
- `eslint-plugin-boundaries` + `no-restricted-imports` para as fronteiras de arquitetura
- Pino (`nestjs-pino`) para logs; `@nestjs/terminus` para health checks
- Jest para testes

## Comandos

```bash
npm run start:dev          # API em watch mode
npm run start:worker:dev   # Worker em watch mode
npm run build
npm run lint               # inclui a checagem de fronteiras entre módulos
npm run format             # Prettier (aspas simples, trailing comma, 100 colunas)
npm test                   # unitários (test:watch, test:cov)
npm run test:e2e
npm run prisma:migrate -- --name <nome>   # nova migration + regenera o client
npm run prisma:generate
```

O Prisma 7 não roda mais o `generate` após o `migrate dev` — use o script, não o comando direto.

## Estrutura

```
src/
├── main.ts / app.module.ts          # processo API (HTTP + WebSocket)
├── worker.ts / worker.module.ts     # processo Worker (consumidores de fila)
├── config/                          # env.schema.ts (Zod) — o boot falha se a env for inválida
├── health/
├── shared/                          # shared kernel — SEM regra de negócio
│   ├── domain/                      # Entity, AggregateRoot, DomainEvent, DomainError/NotFoundError/ConflictError
│   ├── application/                 # ports genéricos: EventBus, IdGenerator, TenantContext; pagination
│   ├── infra/                       # shared-infra.module.ts (liga ports → adapters), prisma, events, context (CLS), id
│   ├── http/                        # shared-http.module.ts, DomainErrorFilter, ZodValidationPipe
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

- `identity` — users, credenciais, sessões (login, refresh, logout)
- `accounts` — tenants, memberships, roles, teams, invitations
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
- Controllers são finos: validam (DTO), chamam **um** use case e mapeiam a resposta. Sem regra de negócio.
- Um use case = uma classe com um método público `execute(input)`.

## Regras de módulos

- Um módulo só importa de outro através do `index.ts` dele. Importar arquivos internos de outro módulo é proibido (o lint barra).
- As fronteiras são verificadas pelo `npm run lint` (`eslint.config.mjs`): direção das camadas, acesso entre módulos só via `index.ts`, domínio sem pacotes externos, `testing/` só em `.spec.ts`. As regras são genéricas por padrão de pasta — módulos novos são cobertos sem alterar a config.
- Comunicação entre módulos: **síncrona** via Facade exportada, ou **assíncrona** via eventos (preferível quando o chamador não precisa da resposta).
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
- Toda tabela de negócio tem `tenantId` e toda query filtra por ele.
- Repositórios acessam o banco **sempre** por `TransactionHost.tx` (nunca pelo `PrismaService` direto), para participar da transação em andamento. Use cases com mais de uma escrita usam `@Transactional()`.
- Migrations sempre pelo Prisma; nunca alterar o banco manualmente.

## Eventos, filas e webhooks

- Eventos de domínio são registrados no aggregate e publicados após o commit. Eventos que cruzam módulos passam pelo **outbox** (gravado na mesma transação).
- O `EventBus` é um port: em memória no MVP, broker (RabbitMQ/NATS) quando um módulo for extraído. Handlers não sabem qual implementação está em uso.
- Contrato de evento é público e versionado (`message.received.v1`); ficam em `domain/events/` e são exportados no `index.ts`.
- Webhooks de canais: o controller valida a assinatura, enfileira o payload bruto e responde 200. O processamento acontece no Worker.
- Todo processor de fila é **idempotente** (dedup pelo ID externo da mensagem) e usa retry com backoff.

## HTTP

- Rotas versionadas: `/v1/...`. DTOs com Zod em `http/dto/`, aplicados com `new ZodValidationPipe(schema)` em `@Body`, `@Query` e `@Param`.
- DTOs validam só o **formato**; regras de negócio (telefone válido, duplicidade) ficam no domínio.
- Respostas passam por um presenter (`<entidade>.presenter.ts`) — a entidade nunca é serializada direto.
- Erros de domínio estendem `DomainError` (com `code` estável, ex.: `CONTACT_INVALID_PHONE`); o `DomainErrorFilter` mapeia para HTTP. Nunca lançar `HttpException` fora de `http/`.
- Corpo de erro sempre `{ code, message }` (+ `issues` em validação). Status: `VALIDATION_ERROR` 400 · tenant ausente 401 · `NotFoundError` 404 · `ConflictError` 409 · demais `DomainError` 422.
- Recurso de outro tenant responde **404** (não 403), para não revelar que existe.
- Listagens usam paginação por cursor (`limit` + `cursor`, resposta `{ items, nextCursor }`), ordenadas por id (UUIDv7) decrescente.

## Autenticação, tenant e permissões

- Guard global de JWT: **todo endpoint é autenticado por padrão**; exceções explícitas com `@Public()`.
- Autorização por `@RequirePermissions('recurso:ação')` no controller. Permissões vêm do catálogo em código (módulo `accounts`) — nunca strings soltas.
- Permissões com escopo de dados (`:own`, `:team`, `:all`): o guard checa se há alguma variante; o **use case/query aplica o escopo**.
- O tenant da requisição fica no `TenantContext` (nestjs-cls). **Repositórios** leem o tenant do contexto e filtram toda query por ele; use cases e controllers não recebem `tenantId` como parâmetro.
- Jobs de fila carregam `tenantId`; o processor preenche o `TenantContext` antes de executar.
- WebSocket: token validado na conexão; eventos emitidos só para a sala do tenant.
- Índices de tabelas de negócio começam pelo `tenantId`.
- Access token contém só `sub`, `tid`, `mid`; permissões são resolvidas por requisição (cache Redis).
- **TEMPORÁRIO:** enquanto o módulo `identity` não existe, o tenant vem do header `x-dev-tenant-id` (UUID), aceito **só fora de produção** (`shared/infra/context/dev-tenant-header.ts`). Remover junto com a criação do AuthGuard; os controllers afetados têm `TODO(auth)`.

## Convenções de nomes

- Arquivos em kebab-case com sufixo do papel: `.entity.ts`, `.vo.ts`, `.event.ts`, `.error.ts`, `.use-case.ts`, `.input.ts`, `.facade.ts`, `.repository.ts` (port), `prisma-*.repository.ts` / `in-memory-*.repository.ts` (adapters), `.mapper.ts`, `.controller.ts`, `.presenter.ts`, `.gateway.ts`, `.dto.ts`, `.query.ts`, `.processor.ts`, `.handler.ts`, `.spec.ts`.
- Eventos expõem o nome também como estático (`ContactCreatedEvent.eventName`), para uso em `@OnEvent(...)` sem string solta.
- Classes em PascalCase com o mesmo sufixo (`SendMessageUseCase`, `PrismaConversationRepository`).

## Testes

- `domain/`: testes unitários puros, sem Nest.
- Use cases: unitários com fakes dos ports, sem banco e sem Nest (instanciados com `new`). Fakes do shared kernel em `shared/testing/fakes.ts`; repositório em memória do módulo em `<modulo>/testing/`, reproduzindo o contrato do real (isolamento por tenant, unicidade, ordem).
- Todo módulo tenant-aware tem teste provando que um tenant não enxerga dados de outro (`FakeTenantContext.switchTo`).
- Repositórios e fluxos HTTP: e2e em `test/e2e/` contra Postgres real (container).
- Todo use case novo vem com `.spec.ts`.

## Criando um módulo novo

1. `src/modules/<modulo>/` com as quatro camadas e o `index.ts` (use `contacts` como modelo).
2. `prisma/schema/<modulo>.prisma` com `@@schema("<modulo>")`; adicionar o schema à lista `schemas` em `base.prisma`; `npm run prisma:migrate -- --name <nome>`.
3. Registrar o módulo em `app.module.ts` importando do `index.ts` (e o `.worker.module.ts` em `worker.module.ts`, se houver).
4. Rodar `npm run lint` e `npm test` — as fronteiras já cobrem o módulo novo.
