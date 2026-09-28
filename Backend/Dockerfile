# syntax=docker/dockerfile:1.7
#
# Uma imagem para os três processos do backend (api, worker, whatsapp-connector):
# muda só o comando. O alvo `migrate` é separado — leva o CLI do Prisma, que
# os serviços não precisam — e roda as migrations no deploy, antes deles.
#
#   docker build -t backend .                      # runtime (padrão)
#   docker build --target migrate -t backend-migrate .

ARG NODE_IMAGE=node:24-alpine

# ─── Dependências completas (build e migrations) ───────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# O postinstall roda `prisma generate` (client em src/.../generated).
RUN npm ci

# ─── Build ─────────────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run prisma:generate && npm run build

# ─── Só dependências de produção ───────────────────────────────────────────
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: o client do Prisma já vem compilado no dist (sem CLI aqui).
# O CLI do Prisma é peer OBRIGATÓRIO do @nestjs-cls/transactional-adapter-prisma,
# então o npm o instala mesmo com --omit=dev — e ele arrasta ~220 MB (Studio,
# PGlite, TypeScript, React...). Nada disso roda em produção: o client usa só
# @prisma/client + @prisma/adapter-pg. Removido à mão.
RUN npm ci --omit=dev --ignore-scripts \
  && rm -rf node_modules/prisma node_modules/typescript node_modules/effect \
    node_modules/react node_modules/react-dom node_modules/@electric-sql \
    node_modules/@prisma/config node_modules/@prisma/dev node_modules/@prisma/studio-core \
    node_modules/@prisma/engines node_modules/@prisma/engines-version \
    node_modules/@prisma/fetch-engine node_modules/@prisma/get-platform \
  && npm cache clean --force

# ─── Migrations (roda uma vez por deploy) ──────────────────────────────────
FROM deps AS migrate
ENV NODE_ENV=production
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ─── Runtime (api / worker / whatsapp-connector) ───────────────────────────
FROM ${NODE_IMAGE} AS runtime
# tini como PID 1: repassa o SIGTERM do Swarm ao Node (graceful shutdown) e
# recolhe processos órfãos.
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
ENTRYPOINT ["/sbin/tini", "--"]
# Padrão: api. Worker e conector trocam o comando no stack.
CMD ["node", "dist/main.js"]
