# Subir o ambiente de desenvolvimento local

Passo a passo para rodar o OminiChannel na máquina de desenvolvimento:
infraestrutura no Docker (dentro do WSL), backend e frontend no Windows.

| O quê | Onde roda | Endereço |
| --- | --- | --- |
| Painel (frontend, Vite) | Windows | http://localhost:5180 |
| API | Windows | http://localhost:3000 |
| Worker (filas) | Windows | health em http://localhost:3001/health/ready |
| Conector do WhatsApp | Windows | health em http://localhost:3002/health/live |
| Postgres | Docker (WSL) | `127.0.0.1:5432` |
| Redis | Docker (WSL) | `127.0.0.1:6379` |
| MinIO (arquivos, API S3) | Docker (WSL) | API `127.0.0.1:9000`, console http://127.0.0.1:9001 |
| Sites dos clientes (nginx) | Docker (WSL) | `http://<endereço-do-site>.localhost:8088` |

> A porta do front é a **5180**, não a 5173 padrão do Vite (a 5173 é usada
> por outro projeto da máquina). Ela precisa bater com `CORS_ORIGINS` e
> `APP_URL` do `Backend/.env`.

## Pré-requisitos

- **Windows com WSL 2 e Ubuntu 22.04**, com o **Docker Engine instalado
  dentro do WSL** (sem Docker Desktop). Os comandos `docker` rodam num
  terminal WSL.
- WSL em modo de rede espelhado: no `%USERPROFILE%\.wslconfig`,

  ```ini
  [wsl2]
  networkingMode=mirrored
  ```

  No modo NAT padrão, as conexões de saída do WSL eram bloqueadas nesta
  máquina e o Docker não baixava imagens.
- **Node.js 24 LTS** e npm, no Windows.

## Primeira vez

### 1. Arquivos de ambiente

Os `.env` ficam **fora do git**. Copie os modelos e troque os valores:

| Copie | Para | O que preencher |
| --- | --- | --- |
| `Docker/.env.example` | `Docker/.env` | `POSTGRES_PASSWORD` e `MINIO_ROOT_PASSWORD` (senhas suas, de dev) |
| `Backend/.env.example` | `Backend/.env` | a senha do Postgres na `DATABASE_URL`, a do MinIO em `S3_SECRET_KEY`, `JWT_SECRET` e `ENCRYPTION_KEY` |
| `Frontend/.env.example` | `Frontend/.env` | normalmente nada (`VITE_API_URL=http://localhost:3000`) |

As senhas do `Docker/.env` precisam **bater** com as do `Backend/.env`.
Gere os segredos no terminal:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use sempre `127.0.0.1` nos endereços do `Backend/.env` (o modelo já vem
assim): no modo espelhado, `localhost` pode resolver para o IPv6 (`::1`) e
não chegar aos containers.

### 2. Dependências

```bash
cd Backend && npm install     # o postinstall já gera o cliente do Prisma
cd ../Frontend && npm install
```

### 3. Infraestrutura

Abra um **terminal WSL** e suba os containers do projeto:

```bash
cd /mnt/c/Developer/Daedalus/OminiChannel/Docker
docker compose -f compose.dev.yaml up -d
docker compose -f compose.dev.yaml ps     # todos "healthy" (o sites só "Up")
```

Os buckets `omnichannel` (privado) e `sites` (leitura pública) são criados
pelo MinIO na primeira subida.

### 4. Banco

```bash
cd Backend
npx prisma migrate deploy
```

### 5. Conta da plataforma

1. Suba o backend e o front (ver "Dia a dia" abaixo) e crie uma conta pela
   tela de cadastro do painel.
2. Defina essa conta como a **conta da plataforma** (a raiz da árvore de
   contas, ADR 0009). É ela que mantém os modelos de site e de landing page
   e o catálogo de planos:

   ```bash
   cd Backend
   npm run build
   node --env-file=.env dist/designate-root.js <slug-da-conta>
   ```

   O slug aparece no seletor de contas e no endereço sugerido para o site.
   Basta fazer isso uma vez.

## Dia a dia

1. **Abra um terminal WSL e deixe-o aberto.** O WSL desliga quando não há
   sessão aberta, e os containers caem junto.
2. Suba a infraestrutura (se não estiver de pé), no terminal WSL:

   ```bash
   cd /mnt/c/Developer/Daedalus/OminiChannel/Docker
   docker compose -f compose.dev.yaml up -d
   ```

3. Em um terminal do Windows, o backend (API, worker e conector juntos, com
   recarga automática):

   ```bash
   cd Backend
   npm run dev
   ```

   Os logs vêm prefixados com `[api]`, `[worker]` e `[wa]`. A primeira
   compilação leva um ou dois minutos.

4. Em outro terminal do Windows, o front:

   ```bash
   cd Frontend
   npm run dev
   ```

5. Confira que tudo respondeu:

   ```bash
   curl http://127.0.0.1:3000/health/ready    # API
   curl http://127.0.0.1:3001/health/ready    # worker
   curl http://127.0.0.1:3002/health/live     # conector do WhatsApp
   ```

   e abra http://localhost:5180.

### Quando o schema do banco muda

Depois de puxar uma migration nova:

```bash
cd Backend
npx prisma migrate deploy
npx prisma generate
```

Pare e suba o `npm run dev` de novo: o modo watch não percebe o cliente do
Prisma novo. O mesmo vale quando muda o `nest-cli.json` (assets copiados para
o build).

## Desligar

1. `Ctrl+C` nos terminais do `npm run dev` (backend e front).
2. No terminal WSL, pare os containers do projeto:

   ```bash
   cd /mnt/c/Developer/Daedalus/OminiChannel/Docker
   docker compose -f compose.dev.yaml stop
   ```

   `stop` mantém os dados (banco, arquivos). **Não use `down -v`** (apaga os
   volumes) nem comandos globais como `docker system prune`: o Docker desta
   máquina também roda outros projetos.

## Testes

```bash
cd Backend
npm test              # unitários
npm run test:e2e      # e2e: precisa dos containers de pé
```

O e2e usa um ambiente **isolado** do de desenvolvimento: banco
`<nome>_e2e` (criado e migrado pelo próprio teste), Redis no db 1 e filas com
prefixo próprio. Mesmo assim, **pare o `npm run dev` antes de rodar o e2e**:
o worker de desenvolvimento disputa os eventos com o teste.

```bash
cd Frontend
npm run lint
npm run build         # checagem de tipos + build de produção
npm run test:e2e      # Playwright: exige a API (3000) e o front (5180) rodando
```

## Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| API não sobe: "connect ECONNREFUSED 127.0.0.1:5432" | Os containers caíram (o WSL desligou). Abra um terminal WSL e rode o `docker compose ... up -d`. |
| `docker` não baixa imagens / sem rede no WSL | Confira o `networkingMode=mirrored` no `.wslconfig`; no PowerShell, `wsl --shutdown` e abra o terminal WSL de novo. |
| Prisma CLI dá timeout | Use `127.0.0.1` (não `localhost`) na `DATABASE_URL`. |
| Erros estranhos de tipo depois de mudar o schema | `npx prisma generate` e reinicie o `npm run dev`. |
| Front abre mas não loga ("CORS") | O front precisa estar na porta 5180 e o `CORS_ORIGINS`/`APP_URL` do `Backend/.env` apontar para ela. |
| Site publicado não mostra a mudança | O nginx dos sites guarda as páginas por até 60 s. Espere ou recrie o container: `docker compose -f compose.dev.yaml up -d --force-recreate sites`. |
| Publicar o site dá "publicação desligada" | Faltam `SITES_BUCKET` e `SITES_URL` no `Backend/.env` (o modelo já traz os valores de dev). |
| Porta já em uso (3000–3002, 5180) | Sobrou um processo de uma execução anterior: feche-o (no PowerShell, `Get-NetTCPConnection -LocalPort 3000` mostra o processo). |

Para o ambiente de produção (Docker Swarm), veja [deploy.md](deploy.md).
