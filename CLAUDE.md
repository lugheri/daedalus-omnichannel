# OminiChannel

Plataforma de atendimento omnichannel (WhatsApp, Instagram, e-mail etc.). Fase atual: **MVP**.

## Repositório

- `Backend/` — API + Worker em NestJS. Regras específicas em [Backend/CLAUDE.md](Backend/CLAUDE.md).
- `Frontend/` — stack a definir. Regras próprias irão em `Frontend/CLAUDE.md`.
- `Docker/` — compose de desenvolvimento e stack de produção (Docker Swarm).

## Princípios de arquitetura

- **Monólito modular** no backend. Só extrair um módulo para microsserviço com motivo concreto (carga, time, ciclo de deploy). As fronteiras entre módulos é que tornam essa extração barata — nunca quebrá-las por conveniência.
- **Clean/Hexagonal Architecture + DDD leve** na organização; **SOLID** no design das classes.
- **Serviços stateless**: nada de estado em memória entre requisições, nada gravado no disco do container. Sessão/estado em Redis ou Postgres, arquivos em storage S3-compatível (MinIO em dev).
- **Tudo que é lento ou externo vai para fila**. Webhooks respondem rápido e enfileiram; processamento é idempotente (webhooks chegam duplicados).
- O Frontend fala **apenas com a API pública** do backend, via reverse proxy. Nunca acessa serviços internos, banco ou Redis.

## Multitenancy e acesso

Detalhes e justificativas nos ADRs [0002](docs/adr/0002-multitenancy.md), [0003](docs/adr/0003-controle-de-acesso.md) e [0004](docs/adr/0004-autenticacao.md).

- **Tenant = conta/empresa cliente.** Banco compartilhado com `tenantId` em toda tabela de negócio.
- **O `tenantId` vem só do token autenticado** — nunca de body, URL, query ou header.
- **User é global; o vínculo com o tenant é a Membership**, que tem status e **um** cargo. Uma pessoa pode pertencer a vários tenants.
- **Cargo (Role) define o que se pode fazer; Equipe (Team) define sobre quais dados.** Cargos são por tenant; permissões são um catálogo fixo no código (`recurso:ação`).
- Cargos padrão: Owner (de sistema, intocável), Admin, Supervisor, Agent.
- Administração da plataforma (`platformRole` no User) é separada dos cargos de tenant.
- Limites de plano são *entitlements* do tenant, não permissões.

## Infraestrutura

- Containers Docker orquestrados com **Docker Swarm**; **Traefik** como reverse proxy e TLS.
- **Postgres e Redis ficam fora do Swarm** (gerenciados ou VM dedicada com backup).
- O backend gera **uma única imagem** executada como dois serviços: `api` (`node dist/main.js`) e `worker` (`node dist/worker.js`). Escalam de forma independente.
- Configuração 100% por variáveis de ambiente (12-factor). Segredos via Docker secrets em produção; `.env` só em desenvolvimento e nunca versionado — manter `.env.example` atualizado.
- Todo serviço expõe health checks (`/health/live`, `/health/ready`) e faz graceful shutdown (SIGTERM).
- Nada de código específico de Swarm na aplicação: ela deve rodar igual em Kubernetes, para quando precisarmos de autoscaling (HPA/KEDA).

## Ambiente de desenvolvimento

- Windows + Docker Engine **dentro do WSL** (Ubuntu 22.04), sem Docker Desktop. Comandos `docker` rodam num terminal WSL.
- O WSL desliga quando não há sessão aberta, derrubando os containers: manter um terminal WSL aberto enquanto desenvolve.
- A API roda no Windows (`npm run start:dev`) e acessa os containers via `localhost`.
- Infra local em `Docker/compose.dev.yaml`.

## Convenções gerais

- Node.js 24 LTS, TypeScript em modo `strict`, npm.
- **Código em inglês** (identificadores, nomes de arquivos, rotas, tabelas). **Documentação e comunicação em português.**
- Logs estruturados em JSON com correlation ID propagado entre API, filas e worker.
- Decisões de arquitetura relevantes são registradas como ADR em `docs/adr/NNNN-titulo.md`.
