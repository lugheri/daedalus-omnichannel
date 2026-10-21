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
read -rs CF_TOKEN;  printf '%s' "$CF_TOKEN"  | docker secret create cf_dns_api_token -
unset PG_PASS REDIS_PASS S3_KEY S3_SECRET CF_TOKEN
```

> `cf_dns_api_token` é o token da API da Cloudflare usado pelo Traefik para emitir o certificado curinga dos sites dos clientes ([ADR 0008](adr/0008-hospedagem-sites-clientes.md)). Crie em *My Profile → API Tokens* com a permissão **Zone → DNS → Edit** só na zona do `SITES_DOMAIN`. O Traefik exige o secret mesmo que os sites ainda não estejam no ar.

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

### Conta da plataforma (uma vez, no primeiro deploy)

O cadastro público é controlado por `PUBLIC_SIGNUP_ENABLED` no `.env.prod` (padrão da stack: `false`, fechado). Regras ([ADR 0004](adr/0004-autenticacao.md), adendo de 20/10/2026):

| Situação do banco | `PUBLIC_SIGNUP_ENABLED=false` | `=true` |
| --- | --- | --- |
| nenhuma conta | aceita **só a primeira** (a da plataforma) | idem |
| contas, mas sem raiz | recusa (`SIGNUP_PLATFORM_NOT_READY`) | recusa (`SIGNUP_PLATFORM_NOT_READY`) |
| raiz designada | recusa (`SIGNUP_DISABLED`); convites e contas filhas funcionam | aceita, abaixo da raiz, **no plano padrão** |

O painel pergunta à API (`GET /v1/auth/signup` → `{ enabled }`) e esconde o link "Criar conta" e a tela de cadastro quando a resposta é `false`.

**Ordem, sem pular passos:**

1. Deploy (seção anterior), com `PUBLIC_SIGNUP_ENABLED=false`.
2. **Logo em seguida**, cadastre a conta da Daedalus pelo painel (`https://app.<domínio>/signup`). Enquanto o banco está vazio, qualquer um que chegar primeiro à tela cria essa conta — não deixe o ambiente no ar sem fazer este passo.
3. Marque-a como **raiz** da hierarquia de contas ([ADR 0009](adr/0009-hierarquia-de-contas.md)) (o slug está em `SELECT name, slug FROM accounts.tenants`, na VM de dados):

   ```bash
   docker exec -it $(docker ps -q -f name=omnichannel_api | head -n1) node dist/designate-root.js <slug>
   ```

   Confira que a saída diz **"Contas sem mãe que passaram para debaixo dela: 0"**. Qualquer número acima de zero quer dizer que outra conta foi criada antes (alguém chegou primeiro, ou dois cadastros simultâneos no banco vazio — a regra não os serializa): investigue antes de seguir.
4. Só então, **se for o caso**, abra o cadastro público: confira antes o plano padrão (hoje libera tudo — ADR 0015; crie um plano básico e torne-o padrão), ponha `PUBLIC_SIGNUP_ENABLED=true` no `.env.prod` e rode o `deploy.sh` de novo. (Um `docker service update --env-add` direto funciona, mas o próximo `deploy.sh` volta ao que está no `.env.prod`.)

Sintoma: se no passo 2 o painel mostrar **"Cadastro fechado"** em vez do formulário, já existe outra conta no banco (a API responde `SIGNUP_PLATFORM_NOT_READY`) — não rode o `designate-root` em conta que você não reconhece. Com a raiz definida, o comando recusa qualquer outra conta (a raiz é uma só).

### Redefinir a senha de alguém (procedimento manual)

Ainda **não há** recuperação de senha por e-mail nem troca da própria senha no painel. Quem esqueceu a senha pede a quem opera o ambiente, que roda:

```bash
docker exec -it $(docker ps -q -f name=omnichannel_api | head -n1) node dist/reset-password.js <email>
```

O comando gera uma senha temporária forte (20 caracteres, sem os ambíguos 0/O/1/l/I), grava o hash com o mesmo algoritmo do cadastro (Argon2id), **encerra todas as sessões da pessoa, em todas as contas** (o refresh token deixa de valer; os access tokens em circulação são recusados pela lista de revogadas no Redis) e imprime a senha **uma única vez**, no seu terminal.

- **Confirme a identidade por outro canal** antes (quem pede pelo WhatsApp é mesmo o dono do e-mail?). O comando não pergunta nada: quem tem o shell do Swarm entrega a conta.
- Repasse a senha por um canal seguro e não a guarde. Ela não vai para log nenhum — mas o `docker exec -it` fica no histórico do shell só com o e-mail, não com a senha.
- A pessoa continua com essa senha até haver troca no painel (pendente): oriente a guardá-la num gerenciador de senhas.
- Erros: `USER_NOT_FOUND` (e-mail sem cadastro) e `USER_INVALID_EMAIL` (e-mail malformado) não mudam nada.

## Sites dos clientes

Os sites estáticos dos clientes rodam numa stack separada (`Docker/sites`), atrás do mesmo Traefik. Decisão e motivos: [ADR 0008](adr/0008-hospedagem-sites-clientes.md); domínio próprio: [ADR 0011](adr/0011-dominio-proprio-dos-sites.md).

```
visitante → Cloudflare → Traefik (*.SITES_DOMAIN, certificado curinga)
          → sites (nginx ×2, cache local) → bucket S3 público: <slug>/index.html

visitante → Cloudflare (www.cliente.com.br, HTTPS da Cloudflare) → túnel (cloudflared ×2)
          → sites (nginx) → bucket: www.cliente.com.br/index.html
```

### Uma vez

1. **Domínio dos sites** (separado do painel) com o DNS na **Cloudflare**:
   - registro `A` de `*.SITES_DOMAIN` para o IP público do manager, com proxy ligado (nuvem laranja);
   - *SSL/TLS → Overview*: modo **Full (strict)**.
2. **Bucket público de sites** (`SITES_BUCKET`) no provedor de S3, com leitura pública dos objetos e **sem listagem**. Nada privado vai para esse bucket. O worker publica os sites (e a API grava as imagens) com a **mesma chave do S3 da stack principal** (secrets `s3_access_key`/`s3_secret_key`): ela precisa ler e escrever nos dois buckets. Para o `publish.sh` manual, uma chave própria só desse bucket.
3. Preencha `SITES_DOMAIN`, `SITES_BUCKET`, `SITES_ORIGIN` e `SITES_PUBLIC_ACL` no `Docker/.env.prod`. O `deploy.sh` da stack principal também exige `SITES_DOMAIN` e `SITES_BUCKET` (a API e o worker publicam os sites: [ADR 0010](adr/0010-modulo-de-sites.md)).
4. **Túnel dos domínios próprios** (no seu computador, com o [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) instalado):

```bash
cloudflared tunnel login                      # autoriza a conta da Cloudflare
cloudflared tunnel create omnichannel-sites   # mostra o ID e grava ~/.cloudflared/<ID>.json
```

   No manager: `docker secret create cf_tunnel_credentials <ID>.json` (copie o arquivo e apague depois) e `SITES_TUNNEL_ID=<ID>` no `Docker/.env.prod`. O `deploy.sh` da stack principal passa o destino (`<ID>.cfargotunnel.com`) para o painel mostrar.
5. Com a stack principal no ar:

```bash
cd daedalus-omnichannel/Docker
./sites/deploy-sites.sh
```

O primeiro acesso pode levar até 2 minutos: o Traefik emite o certificado curinga pelo DNS da Cloudflare (`docker service logs omnichannel_traefik` mostra o andamento).

### Publicar o site de um cliente

Pelo painel: **Site › Meu site** na conta do cliente (ou entrando nela pela conta-mãe), com um modelo disponível em **Site › Modelos de site** na conta da plataforma. Publicar vai para a fila; o worker grava `<slug>/index.html` no bucket.

Site montado à mão (fora do módulo), pelo script:

```bash
./sites/publish.sh barbearia-x /caminho/da/pasta/do/site
```

- A pasta precisa de um `index.html` na raiz. `servicos/index.html` vira `https://barbearia-x.SITES_DOMAIN/servicos`.
- O slug aceita letras minúsculas, números e hífen.
- As chaves do bucket são pedidas na hora (ou vêm de `SITES_S3_ACCESS_KEY` / `SITES_S3_SECRET_KEY`); nunca as grave em arquivo.
- Republicar a mesma pasta atualiza o site; arquivo apagado da pasta some do site. A mudança aparece em até 1 minuto.

### Domínio próprio de um cliente

1. Registre o domínio e adicione a zona na **sua** Cloudflare (troque os nameservers no registro.br para os que a Cloudflare indicar). Em *SSL/TLS → Edge Certificates*, ligue **Always Use HTTPS**.
2. No DNS da zona, com proxy ligado (nuvem laranja):
   - `CNAME www → <SITES_TUNNEL_ID>.cfargotunnel.com`
   - `CNAME @ → <SITES_TUNNEL_ID>.cfargotunnel.com` (o domínio sem www, que redireciona para o www)
3. No painel, entrando na conta do cliente (como conta-mãe): **Meu site › Endereço › Domínio próprio** = `www.cliente.com.br`, Salvar e **Publicar**. O painel mostra os registros acima e, depois de publicar, verifica sozinho: **Conectado** quando o DNS já chega no site (pode levar minutos; "Verificar agora" confere de novo).

O certificado HTTPS é o da Cloudflare (Universal SSL, emitido sozinho para a zona). Trocar ou tirar o domínio tira a pasta antiga do ar na próxima publicação.

### Tirar um site do ar

Pelo painel: **Meu site › ⋯ › Tirar do ar**. Site publicado pelo script: apague a pasta do slug no bucket (`aws s3 rm s3://SITES_BUCKET/<slug>/ --recursive`). O cache local expira em até 1 minuto; na Cloudflare, use *Caching → Purge*.

### Conferir

```bash
curl -sI https://barbearia-x.SITES_DOMAIN/            # 200, com X-Cache
curl -sI https://barbearia-x.SITES_DOMAIN/nao-existe  # 404
docker service logs omnichannel-sites_sites
```

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
