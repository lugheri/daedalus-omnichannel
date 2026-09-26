# Backend — NestJS

Monólito modular em NestJS (adapter **Fastify**) com Clean/Hexagonal Architecture. Leia também o [CLAUDE.md da raiz](../CLAUDE.md).

## Stack

- NestJS 12 + `@nestjs/platform-fastify`
- TypeScript **6** — não atualizar para 7 até o Nest CLI suportar (o TS 7.0 não expõe a API de compilação que o CLI usa)
- Prisma (Postgres) — schema dividido por módulo, um schema Postgres por módulo
- Zod (`nestjs-zod`) para validação de entrada e das env vars
- BullMQ (`@nestjs/bullmq`) + Redis para filas
- Socket.IO com Redis adapter para tempo real
- `nestjs-cls` + `@nestjs-cls/transactional` (adapter Prisma) para transações e correlation ID
- Pino (`nestjs-pino`) para logs; `@nestjs/terminus` para health checks
- Jest para testes

## Comandos

```bash
npm run start:dev          # API em watch mode
npm run start:worker:dev   # Worker em watch mode
npm run build
npm run lint               # inclui a checagem de fronteiras entre módulos
npm run format             # Prettier (aspas simples, trailing comma, 100 colunas)
npm test                   # unitários
npm run test:e2e
npx prisma migrate dev --name <nome>   # nova migration
npx prisma generate
```

## Estrutura

```
src/
├── main.ts / app.module.ts          # processo API (HTTP + WebSocket)
├── worker.ts / worker.module.ts     # processo Worker (consumidores de fila)
├── config/                          # env.schema.ts (Zod) — o boot falha se a env for inválida
├── health/
├── shared/                          # shared kernel — SEM regra de negócio
│   ├── domain/                      # Entity, AggregateRoot, DomainEvent, DomainError
│   ├── application/                 # ports genéricos: EventBus, Clock, IdGenerator
│   ├── infra/                       # prisma, events (bus + outbox), queue, storage, logger
│   └── http/                        # filters, interceptors, guards, pipes globais
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
        └── http/                       # controllers, gateways WS, dto/
prisma/schema/                          # base.prisma + um <modulo>.prisma por módulo
```

Módulos iniciais: `identity` (auth, usuários, tenants), `contacts`, `channels` (integração com provedores e webhooks), `conversations`.

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
- Comunicação entre módulos: **síncrona** via Facade exportada, ou **assíncrona** via eventos (preferível quando o chamador não precisa da resposta).
- Cada módulo é dono das suas tabelas. Repositórios de um módulo só acessam os models do próprio módulo.
- **Sem relations do Prisma entre models de módulos diferentes** — guarde só o ID (`contactId: String`). Sem JOIN entre módulos.
- `shared/` não pode depender de nenhum módulo.

## Dados (Prisma)

- Cada `prisma/schema/<modulo>.prisma` declara seus models com `@@schema("<modulo>")`.
- Tipos gerados pelo Prisma **nunca saem de `infra/`**. O repositório converte com um mapper (`toDomain` / `toPersistence`).
- IDs são UUIDv7 gerados pela aplicação (via port `IdGenerator`), não pelo banco.
- Toda tabela de negócio tem `tenantId` e toda query filtra por ele.
- Transações via `@Transactional()` (nestjs-cls) no use case; repositórios usam o client transacional, não o `PrismaService` direto.
- Migrations sempre pelo Prisma; nunca alterar o banco manualmente.

## Eventos, filas e webhooks

- Eventos de domínio são registrados no aggregate e publicados após o commit. Eventos que cruzam módulos passam pelo **outbox** (gravado na mesma transação).
- O `EventBus` é um port: em memória no MVP, broker (RabbitMQ/NATS) quando um módulo for extraído. Handlers não sabem qual implementação está em uso.
- Contrato de evento é público e versionado (`message.received.v1`); ficam em `domain/events/` e são exportados no `index.ts`.
- Webhooks de canais: o controller valida a assinatura, enfileira o payload bruto e responde 200. O processamento acontece no Worker.
- Todo processor de fila é **idempotente** (dedup pelo ID externo da mensagem) e usa retry com backoff.

## HTTP

- Rotas versionadas: `/v1/...`. DTOs com Zod em `http/dto/`.
- Erros de domínio estendem `DomainError`; um exception filter global mapeia para HTTP. Nunca lançar `HttpException` fora de `http/`.
- Autenticação por JWT; guards verificam tenant e permissões.

## Convenções de nomes

- Arquivos em kebab-case com sufixo do papel: `.entity.ts`, `.vo.ts`, `.event.ts`, `.error.ts`, `.use-case.ts`, `.facade.ts`, `.repository.ts` (port), `prisma-*.repository.ts` (adapter), `.mapper.ts`, `.controller.ts`, `.gateway.ts`, `.dto.ts`, `.processor.ts`, `.handler.ts`, `.spec.ts`.
- Classes em PascalCase com o mesmo sufixo (`SendMessageUseCase`, `PrismaConversationRepository`).

## Testes

- `domain/`: testes unitários puros, sem Nest.
- Use cases: unitários com fakes dos ports (repositórios em memória), sem banco.
- Repositórios e fluxos HTTP: e2e em `test/e2e/` contra Postgres real (container).
- Todo use case novo vem com `.spec.ts`.

## Criando um módulo novo

1. `src/modules/<modulo>/` com as quatro camadas e o `index.ts`.
2. `prisma/schema/<modulo>.prisma` com `@@schema("<modulo>")` e o schema adicionado ao datasource.
3. Registrar o módulo em `app.module.ts` (e o `.worker.module.ts` em `worker.module.ts`, se houver).
4. Adicionar o módulo à configuração de fronteiras do ESLint.
