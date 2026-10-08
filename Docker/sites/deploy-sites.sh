#!/usr/bin/env bash
# Sobe ou atualiza o servidor dos sites dos clientes (ADR 0008). Roda no nó
# MANAGER do Swarm, depois que a stack principal já está no ar (o Traefik e a
# rede omnichannel_edge vêm dela):
#
#   ./sites/deploy-sites.sh
#
# Variáveis: Docker/.env.prod (SITES_DOMAIN e SITES_ORIGIN).
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-../.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo $ENV_FILE não encontrado (copie de .env.prod.example)." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for var in SITES_DOMAIN SITES_ORIGIN; do
  if [[ -z "${!var:-}" ]]; then
    echo "Defina $var em $ENV_FILE." >&2
    exit 1
  fi
done

# Domínio com os pontos escapados para a regra HostRegexp do Traefik.
SITES_DOMAIN_RE="$(printf '%s' "$SITES_DOMAIN" | sed 's/\./\\./g')"
# Hash do template: muda o nome da config do Swarm quando o arquivo muda.
SITES_CONFIG_VERSION="$(sha256sum nginx.conf.template | cut -c1-12)"
export SITES_DOMAIN_RE SITES_CONFIG_VERSION

STACK="${SITES_STACK_NAME:-omnichannel-sites}"
echo "▶ Sites: *.${SITES_DOMAIN} → ${SITES_ORIGIN} (stack '${STACK}')"
docker stack deploy --detach=false -c stack.sites.yaml "$STACK"
echo "✔ Servidor de sites no ar. Publique um site com ./sites/publish.sh <slug> <pasta>"
