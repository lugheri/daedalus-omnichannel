# ADR 0007 — Deploy em Docker Swarm com dados fora do cluster

- **Status:** aceito
- **Data:** 2026-09-28

## Contexto

MVP com ~10 clientes, time pequeno e custo como restrição. O backend é uma
imagem com três processos (api, worker, whatsapp-connector — ADR 0001/0006);
o front é uma SPA estática. Precisamos de HTTPS, deploy sem derrubar
atendimento, segredos fora do código e backup do banco — sem a complexidade
de um Kubernetes.

## Decisão

- **VPS/bare metal + Docker Swarm**, com **Traefik** na borda (HTTPS pelo Let's
  Encrypt, roteamento por domínio: `app.` → painel, `api.` → API).
- **Postgres e Redis numa VM dedicada**, fora do Swarm (Docker Compose), com
  portas publicadas só na rede privada e backup diário (`pg_dump`) para S3.
  Redis com AOF e `maxmemory-policy noeviction` (exigência do BullMQ).
- **Arquivos** no S3 compatível do provedor (a aplicação só fala API S3).
- **Imagens no GHCR**, publicadas pelo GitHub Actions a cada tag `v*`; a versão
  vai para produção com `IMAGE_TAG=vX ./Docker/deploy.sh`.
- **Segredos são Docker secrets**, entregues como arquivos; a aplicação aceita a
  convenção `VAR_FILE` (lê o valor do arquivo). Nenhum segredo em variável de
  ambiente visível, em arquivo do repositório ou na imagem.
- **Migrations antes do deploy**, num job único do Swarm (`replicated-job`), com
  uma imagem própria (`omnichannel-backend-migrate`, que leva o CLI do Prisma).
  Se falharem, a stack não é atualizada.
- **Front com configuração de runtime:** a URL da API vem de `API_URL` quando o
  container sobe (`/config.js`), e não do build — a mesma imagem serve
  qualquer ambiente.
- **Rolling update:** API e painel com `start-first` e Traefik roteando pelo VIP
  do Swarm (`lbswarm`): a réplica que sai deixa de receber na hora — medido sem
  nenhum erro durante a troca. Conector com `stop-first`: a instância antiga
  encerra as sessões do WhatsApp (sem logout) e libera os leases; a nova assume
  na hora. Falha de health check → rollback automático.

## Alternativas consideradas

- **Kubernetes (gerenciado ou k3s):** autoscaling e ecossistema maiores, mas
  bem mais operação para um time pequeno e ~10 clientes. Fica como evolução —
  a aplicação já não depende do Swarm.
- **Nuvem com serviços gerenciados (RDS, ElastiCache, S3):** menos manutenção,
  custo várias vezes maior no volume atual.
- **Build no próprio servidor (sem registry):** mais simples no início, mas não
  funciona com vários nós e mistura build com produção.
- **URL da API embutida no build do front:** exigiria uma imagem por ambiente.

## Consequências

- Custo baixo e operação simples; escalar = mais réplicas ou mais nós no Swarm.
- Postgres/Redis numa VM única são um ponto único de falha: aceito no MVP
  (backup diário + restauração documentada). Evolução natural: serviços
  gerenciados ou réplica do Postgres, sem mudar a aplicação (só as URLs).
- Nada na aplicação depende do Swarm: as mesmas imagens, variáveis e `VAR_FILE`
  funcionam em Kubernetes quando precisarmos de autoscaling.
- Migrations precisam ser compatíveis com a versão anterior do código (rollback
  não desfaz migration).
