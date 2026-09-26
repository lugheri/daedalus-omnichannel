# 0002 — Multitenancy por coluna `tenantId`

- **Status:** Aceito
- **Data:** 2026-09-26

## Contexto

A plataforma é um SaaS multitenant: cada cliente (tenant) é uma empresa com seus usuários, canais, contatos e conversas. É esperado um grande número de tenants de porte pequeno e médio. O maior risco do modelo é um tenant enxergar dados de outro.

## Decisão

- **Banco e schemas compartilhados**, com coluna `tenantId` em toda tabela de negócio.
- O `tenantId` **nunca vem do cliente** (body, URL, query ou header): é extraído exclusivamente do token autenticado.
- O tenant da requisição fica num **`TenantContext`** (via `nestjs-cls`), preenchido pelo guard de autenticação no HTTP, na conexão WebSocket e pelo processor no worker (todo job carrega o `tenantId`).
- Os **repositórios** leem o tenant do contexto e filtram toda query por ele; use cases e controllers não recebem `tenantId` como parâmetro.
- **Row-Level Security** do Postgres será adicionada numa fase posterior como defesa em profundidade.
- Eventos WebSocket são transmitidos somente para a sala do tenant.

## Alternativas consideradas

- **Um schema Postgres por tenant** — isolamento maior, mas migrations multiplicadas pelo número de tenants e limites práticos do Postgres com milhares de schemas.
- **Um banco por tenant** — isolamento total e custo alto; reservado a um eventual plano enterprise/regulado, se surgir.

## Consequências

- Operação simples: uma migration, um pool de conexões, backups únicos.
- Índices de negócio devem começar pelo `tenantId` (ex.: `@@index([tenantId, phone])`).
- Um bug de filtro pode vazar dados entre tenants: o `TenantContext` obrigatório nos repositórios e, depois, o RLS existem para mitigar isso. Testes e2e devem cobrir o isolamento.
