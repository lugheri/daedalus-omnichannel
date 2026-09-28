# syntax=docker/dockerfile:1.7
#
# Painel (SPA) servido por nginx. A URL da API NÃO entra no build: vem de
# API_URL quando o container sobe (docker/write-config.sh → /config.js).
# Assim a mesma imagem vale para homologação e produção.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# nginx sem root, na porta 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/write-config.sh /docker-entrypoint.d/05-write-config.sh
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
EXPOSE 8080
