# OminiChannel

Plataforma de atendimento omnichannel (WhatsApp, Instagram, e-mail etc.). Fase atual: **MVP**.

## Repositório

- `Backend/` — API + Worker em NestJS. Regras específicas em [Backend/CLAUDE.md](Backend/CLAUDE.md).
- `Frontend/` — SPA em **React + Vite + shadcn/ui**. Regras específicas em [Frontend/CLAUDE.md](Frontend/CLAUDE.md).
- `Docker/` — compose de desenvolvimento e stack de produção (Docker Swarm).

## Princípios de arquitetura

- **Monólito modular** no backend. Só extrair um módulo para microsserviço com motivo concreto (carga, time, ciclo de deploy). As fronteiras entre módulos é que tornam essa extração barata — nunca quebrá-las por conveniência.
- **Clean/Hexagonal Architecture + DDD leve** na organização; **SOLID** no design das classes.
- **Serviços stateless**: nada de estado em memória entre requisições, nada gravado no disco do container. Sessão/estado em Redis ou Postgres, arquivos em storage S3-compatível (MinIO em dev).
- **Tudo que é lento ou externo vai para fila**. Webhooks respondem rápido e enfileiram; processamento é idempotente (webhooks chegam duplicados).
- O Frontend fala **apenas com a API pública** do backend, via reverse proxy. Nunca acessa serviços internos, banco ou Redis.

## Multitenancy e acesso

Detalhes e justificativas nos ADRs [0002](docs/adr/0002-multitenancy.md), [0003](docs/adr/0003-controle-de-acesso.md), [0004](docs/adr/0004-autenticacao.md) e [0005](docs/adr/0005-refresh-token-em-cookie.md).

- **Tenant = conta/empresa cliente.** Banco compartilhado com `tenantId` em toda tabela de negócio.
- **O `tenantId` vem só do token autenticado** — nunca de body, URL, query ou header.
- **User é global; o vínculo com o tenant é a Membership**, que tem status e **um** cargo. Uma pessoa pode pertencer a vários tenants.
- **Cargo (Role) define o que se pode fazer; Equipe (Team) define sobre quais dados.** Cargos são por tenant; permissões são um catálogo fixo no código (`recurso:ação`).
- Cargos padrão: Owner (de sistema, intocável), Admin, Supervisor, Agent.
- Administração da plataforma (`platformRole` no User) é separada dos cargos de tenant.
- Limites de plano são _entitlements_ do tenant, não permissões.
- **Sessão no navegador:** access token no corpo (o front guarda só em memória); refresh token em cookie `HttpOnly` + `SameSite=Strict` restrito a `/v1/auth`. Por isso **front e API precisam estar no mesmo site** (ex.: `app.dominio.com` e `api.dominio.com`) e o front usa `credentials: 'include'` nas rotas de auth.

## Infraestrutura

- Containers Docker orquestrados com **Docker Swarm**; **Traefik** como reverse proxy e TLS.
- **Postgres e Redis ficam fora do Swarm** (gerenciados ou VM dedicada com backup).
- O backend gera **uma única imagem** executada como três serviços, que escalam e são atualizados de forma independente:
  - `api` (`node dist/main.js`) — HTTP e WebSocket, stateless;
  - `worker` (`node dist/worker.js`) — consumidores de fila;
  - `whatsapp-connector` (`node dist/whatsapp-connector.js`) — conexões persistentes do Baileys (com estado; cada número pertence a uma instância). Tratado como serviço à parte: só fala com o resto por filas/eventos no Redis e tem tabelas próprias ([ADR 0006](docs/adr/0006-canais-whatsapp.md)).
- **WhatsApp:** API oficial (Cloud API, empresa como Tech Provider da Meta) e não oficial (Baileys), atrás da mesma abstração no módulo `channels`. O Baileys é o canal inicial do MVP (clientes cientes).
- **Arquivos:** S3 em produção, MinIO em desenvolvimento — mesmo adapter (API S3), muda só a configuração.
- Configuração 100% por variáveis de ambiente (12-factor). Segredos via Docker secrets em produção; `.env` só em desenvolvimento e nunca versionado — manter `.env.example` atualizado.
- Todo serviço expõe health checks (`/health/live`, `/health/ready`) e faz graceful shutdown (SIGTERM).
- Nada de código específico de Swarm na aplicação: ela deve rodar igual em Kubernetes, para quando precisarmos de autoscaling (HPA/KEDA).

## Ambiente de desenvolvimento

- Windows + Docker Engine **dentro do WSL** (Ubuntu 22.04), sem Docker Desktop. Comandos `docker` rodam num terminal WSL.
- O WSL desliga quando não há sessão aberta, derrubando os containers: manter um terminal WSL aberto enquanto desenvolve.
- A API roda no Windows (`npm run start:dev`, porta 3000) e o front também (`npm run dev`, porta **5180** — a 5173 é usada por outro projeto da máquina).
- Infra local em `Docker/compose.dev.yaml`: Postgres (5432), Redis (6379) e MinIO (API 9000, console 9001 — `omnichannel` / `omnichannel-dev`; bucket `omnichannel` criado na subida).
  - A MinIO deixou de publicar imagens públicas (Docker Hub e Quay pedem login). Usamos a cópia congelada `bitnamilegacy/minio` — ok para dev. O código fala só a API S3: trocar por outro compatível (SeaweedFS, RustFS) é só mexer no compose.
- O WSL usa `networkingMode=mirrored` (em `%USERPROFILE%\.wslconfig`): no modo NAT padrão, as conexões TCP de saída do WSL eram bloqueadas nesta máquina (o Docker não baixava imagens). Se voltar a acontecer: `wsl --shutdown` no PowerShell e abrir o terminal WSL de novo.
- Nesse modo, **só o IPv4 de loopback chega aos containers**: use `127.0.0.1` (não `localhost`, que pode resolver para `::1` e dar timeout — o CLI do Prisma cai nisso). O `.env` já usa `127.0.0.1`.

## Convenções gerais

- Node.js 24 LTS, TypeScript em modo `strict`, npm.
- **Código em inglês** (identificadores, nomes de arquivos, rotas, tabelas). **Documentação e comunicação em português.**
- Logs estruturados em JSON com correlation ID propagado entre API, filas e worker.
- Decisões de arquitetura relevantes são registradas como ADR em `docs/adr/NNNN-titulo.md`.
