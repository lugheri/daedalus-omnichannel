# Deploy em produção

Guia para colocar o Omnichannel no ar e mantê-lo. Decisões e motivos: [ADR 0007](adr/0007-deploy-swarm.md).

```
               Internet (HTTPS)
                     │
   ┌── Swarm (1+ VPS) ──────────────────────────────┐
   │  traefik  → app.<domínio> → web (nginx, ×2)    │
   │           → api.<domínio> → api (×2)           │
   │  worker (×1)   whatsapp-connector (×1)         │
   └──────────────────────┬─────────────────────────┘
                          │ rede privada
   ┌── VM de dados ───────┴─────────────────────────┐
   │  postgres   redis   backup diário → S3         │
   └────────────────────────────────────────────────┘
   Arquivos (mídia): S3 compatível do provedor
```

## O que você precisa

- **Servidores Linux** (Ubuntu 24.04 LTS, por exemplo) no mesmo provedor, com **rede privada** entre eles:
  - **Swarm:** 1 VPS para começar (4 vCPU / 8 GB é folgado para ~10 clientes). Dá para somar nós depois.
  - **Dados:** 1 VM (2 vCPU / 4 GB, disco SSD) para Postgres e Redis.
- **Domínio** com dois registros DNS tipo A apontando para o IP **público** do nó manager do Swarm:
  `app.<domínio>` e `api.<domínio>`. Precisam ser do **mesmo domínio** (o cookie de sessão é `SameSite=Strict`).
- **Dois buckets S3** no provedor: um para mídia (`omnichannel-prod`) e outro para backups (`omnichannel-backups`), com chaves de acesso **diferentes** para cada um.
- Imagens publicadas no GHCR (ver "Publicar uma versão").

## 1. Preparar os servidores (uma vez)

Em **todos** os servidores:

```bash
curl -fsSL https://get.docker.com | sh
# firewall: libere só o necessário
ufw default deny incoming && ufw allow OpenSSH
```

- **Nó manager do Swarm:** `ufw allow 80,443/tcp` (e, se tiver mais nós, as portas do Swarm 2377/tcp, 7946/tcp+udp, 4789/udp **só pela rede privada**).
- **VM de dados:** libere 5432 e 6379 **só para o IP privado dos nós do Swarm**:
  `ufw allow from <IP-privado-do-swarm> to any port 5432,6379 proto tcp`.

## 2. VM de dados

```bash
git clone https://github.com/lugheri/daedalus-omnichannel.git && cd daedalus-omnichannel/Docker/data
cp .env.example .env        # ajuste PRIVATE_IP e o bucket de backups
mkdir -p secrets && chmod 700 secrets
openssl rand -base64 32 | tr -d '\n' > secrets/postgres_password
openssl rand -base64 32 | tr -d '/+=\n' > secrets/redis_password
printf '%s' 'CHAVE-DE-ACESSO-DO-BUCKET-DE-BACKUP' > secrets/backup_s3_access_key
printf '%s' 'SEGREDO-DO-BUCKET-DE-BACKUP'       > secrets/backup_s3_secret_key
chmod 600 secrets/*
docker compose up -d --build
docker compose logs backup   # deve mostrar "[backup] enviado: ..." (o 1º backup roda na subida)
```

Guarde as duas senhas geradas num cofre de senhas: vão nos secrets do Swarm abaixo.

## 3. Swarm (nó manager)

```bash
docker swarm init --advertise-addr <IP-privado-do-manager>
git clone https://github.com/lugheri/daedalus-omnichannel.git && cd daedalus-omnichannel/Docker
cp .env.prod.example .env.prod   # domínios, e-mail do Let's Encrypt, S3 de mídia
```

**Secrets** (criados uma vez; ficam cifrados no Swarm e chegam aos containers como arquivos em `/run/secrets`). Use `printf` para não gravar no histórico do shell um `echo` com quebra de linha:

```bash
read -rs PG_PASS    # cole a senha de secrets/postgres_password da VM de dados
read -rs REDIS_PASS # idem, secrets/redis_password
printf 'postgresql://omnichannel:%s@<IP-privado-dados>:5432/omnichannel' "$PG_PASS" | docker secret create database_url -
printf 'redis://:%s@<IP-privado-dados>:6379' "$REDIS_PASS" | docker secret create redis_url -
openssl rand -base64 48 | tr -d '\n' | docker secret create jwt_secret -
openssl rand -base64 32 | tr -d '\n' | docker secret create encryption_key -
read -rs S3_KEY;    printf '%s' "$S3_KEY"    | docker secret create s3_access_key -
read -rs S3_SECRET; printf '%s' "$S3_SECRET" | docker secret create s3_secret_key -
unset PG_PASS REDIS_PASS S3_KEY S3_SECRET
```

> A senha do Postgres/Redis com caracteres especiais (`@`, `/`, `:`) precisa ser *URL-encoded* na URL. As geradas acima (`tr -d '/+='` no Redis) evitam isso; no Postgres, se tiver `/` ou `+`, gere de novo ou codifique.
>
> **`encryption_key` cifra as sessões do WhatsApp no banco. Guarde uma cópia no cofre**: se ela se perder, todos os números precisam ser pareados de novo.

Se as imagens forem privadas no GHCR, faça login uma vez (token com `read:packages`):
`echo <token> | docker login ghcr.io -u <usuário-github> --password-stdin`.

## 4. Deploy

```bash
cd daedalus-omnichannel/Docker && git pull
IMAGE_TAG=v1.0.0 ./deploy.sh
```

O script:
1. roda as **migrations** num job único do Swarm (com o secret do banco) — se falharem, **nada é atualizado**;
2. atualiza a stack com **rolling update**: API e painel sobem a réplica nova antes de tirar a antiga (sem erro para quem está usando), o conector troca de instância liberando as sessões do WhatsApp na hora (sem novo QR code), e qualquer serviço que não passar no health check volta sozinho para a versão anterior.

Conferir:

```bash
docker service ls                          # réplicas N/N
curl -s https://api.<domínio>/health/ready  # {"status":"ok",...}
docker service logs -f omnichannel_api     # logs em JSON
```

O primeiro acesso a `https://app.<domínio>` pode levar alguns segundos: o Traefik emite o certificado do Let's Encrypt.

## Publicar uma versão

```bash
git tag v1.0.0 && git push origin v1.0.0
```

O GitHub Actions (`release.yml`) publica no GHCR:
`omnichannel-backend`, `omnichannel-backend-migrate` e `omnichannel-web`, com a tag da versão. Depois é o `deploy.sh` acima.

## Voltar uma versão (rollback)

```bash
IMAGE_TAG=v0.9.0 ./deploy.sh
```

Migrations **não são desfeitas**: por isso toda migration deve ser compatível com a versão anterior do código (ex.: acrescentar coluna nullable; remover só num deploy seguinte).

## Backups

- `pg_dump` diário (03:00 UTC) para `s3://<bucket-de-backups>/postgres/`, com retenção de `BACKUP_RETENTION_DAYS` (14).
- **Restaurar** (na VM de dados):

```bash
cd daedalus-omnichannel/Docker/data
docker compose exec backup sh -c '
  export AWS_ACCESS_KEY_ID=$(cat $AWS_ACCESS_KEY_ID_FILE) AWS_SECRET_ACCESS_KEY=$(cat $AWS_SECRET_ACCESS_KEY_FILE)
  export PGPASSWORD=$(cat $PGPASSWORD_FILE)
  aws --endpoint-url $BACKUP_S3_ENDPOINT s3 ls s3://$BACKUP_S3_BUCKET/postgres/'
# escolha o arquivo e restaure num banco NOVO; confira; só então troque
docker compose exec backup sh -c '... s3 cp s3://.../omnichannel-<data>.dump /tmp/r.dump
  && createdb omnichannel_restaurado && pg_restore --no-owner -d omnichannel_restaurado /tmp/r.dump'
```

- Teste uma restauração de vez em quando. Backup nunca testado não é backup.
- Redis: filas e sessões ficam em disco (AOF) e sobrevivem a um restart; não precisa de backup externo (o outbox no Postgres reenvia eventos pendentes).

## Trocar um segredo

Secrets do Swarm são imutáveis: crie um novo com outro nome e troque no serviço.

```bash
openssl rand -base64 48 | tr -d '\n' | docker secret create jwt_secret_v2 -
docker service update --secret-rm jwt_secret --secret-add source=jwt_secret_v2,target=jwt_secret omnichannel_api
# repita para worker e whatsapp-connector; depois: docker secret rm jwt_secret
```

(Trocar o `jwt_secret` desloga todo mundo; trocar a `encryption_key` exige parear os números de novo.)
