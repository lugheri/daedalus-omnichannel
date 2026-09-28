#!/usr/bin/env bash
# Deploy de produção. Roda no nó MANAGER do Swarm:
#
#   IMAGE_TAG=v1.2.0 ./deploy.sh
#
# 1. Roda as migrations do banco num job único do Swarm (com o secret do banco).
# 2. Só se elas passarem, atualiza a stack (rolling update, com rollback
#    automático se os health checks falharem).
#
# Variáveis: Docker/.env.prod (fora do git; modelo em .env.prod.example).
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo $ENV_FILE não encontrado (copie de .env.prod.example)." >&2
  exit 1
fi
# IMAGE_TAG pode vir da linha de comando e vence o arquivo.
cli_tag="${IMAGE_TAG:-}"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
IMAGE_TAG="${cli_tag:-${IMAGE_TAG:-}}"
export IMAGE_TAG

for var in APP_DOMAIN API_DOMAIN ACME_EMAIL IMAGE_REGISTRY IMAGE_TAG S3_ENDPOINT S3_REGION S3_BUCKET; do
  if [[ -z "${!var:-}" ]]; then
    echo "Defina $var em $ENV_FILE (ou na linha de comando)." >&2
    exit 1
  fi
done

STACK="${STACK_NAME:-omnichannel}"
echo "▶ Deploy de ${IMAGE_REGISTRY} @ ${IMAGE_TAG} na stack '${STACK}'"

# ─── 1. Migrations ─────────────────────────────────────────────────────────
job="${STACK}_migrate_$(date +%Y%m%d%H%M%S)"
echo "▶ Migrations (job ${job})"
docker service create \
  --name "$job" \
  --mode replicated-job \
  --restart-condition none \
  --with-registry-auth \
  --secret database_url \
  --env DATABASE_URL_FILE=/run/secrets/database_url \
  --detach \
  "${IMAGE_REGISTRY}/omnichannel-backend-migrate:${IMAGE_TAG}" >/dev/null

state=""
for _ in $(seq 1 120); do
  state="$(docker service ps "$job" --format '{{.CurrentState}}' | head -n1)"
  case "$state" in
    Complete*|Failed*|Rejected*) break ;;
  esac
  sleep 2
done
docker service logs --raw "$job" 2>/dev/null | tail -n 30 || true
docker service rm "$job" >/dev/null
if [[ "$state" != Complete* ]]; then
  echo "✖ Migrations falharam (${state:-sem estado}). Stack NÃO foi atualizada." >&2
  exit 1
fi

# ─── 2. Stack ──────────────────────────────────────────────────────────────
echo "▶ Atualizando a stack"
docker stack deploy \
  --with-registry-auth \
  --detach=false \
  -c stack.prod.yaml \
  "$STACK"

echo "✔ Deploy concluído: https://${APP_DOMAIN} (API: https://${API_DOMAIN})"
