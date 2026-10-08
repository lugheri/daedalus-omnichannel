#!/usr/bin/env bash
# Publica (ou atualiza) o site de um cliente no bucket público de sites
# (ADR 0008). Enquanto o módulo de sites não existe, é assim que um site
# montado à mão vai para o ar:
#
#   ./sites/publish.sh barbearia-x ./caminho/da/pasta/do/site
#
# A pasta precisa ter um index.html na raiz. Páginas internas como
# servicos/index.html ficam em https://<slug>.<SITES_DOMAIN>/servicos.
#
# Chaves do bucket de sites: SITES_S3_ACCESS_KEY e SITES_S3_SECRET_KEY no
# ambiente, ou digitadas quando o script pedir (nunca em arquivo).
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Uso: $0 <slug> <pasta-do-site>" >&2
  exit 1
fi
slug="$1"
dir="$(cd "$2" && pwd)"

# Mesmo formato que o nginx e o Traefik aceitam no subdomínio.
if [[ ! "$slug" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
  echo "Slug inválido: use letras minúsculas, números e hífen (ex.: barbearia-x)." >&2
  exit 1
fi
if [[ ! -f "$dir/index.html" ]]; then
  echo "A pasta $dir não tem index.html na raiz." >&2
  exit 1
fi

ENV_FILE="${ENV_FILE:-$(dirname "$0")/../.env.prod}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi
for var in SITES_BUCKET SITES_DOMAIN S3_ENDPOINT S3_REGION; do
  if [[ -z "${!var:-}" ]]; then
    echo "Defina $var em $ENV_FILE (ou no ambiente)." >&2
    exit 1
  fi
done

if [[ -z "${SITES_S3_ACCESS_KEY:-}" ]]; then read -rsp "Chave de acesso do bucket de sites: " SITES_S3_ACCESS_KEY; echo; fi
if [[ -z "${SITES_S3_SECRET_KEY:-}" ]]; then read -rsp "Segredo do bucket de sites: " SITES_S3_SECRET_KEY; echo; fi

style="virtual"
[[ "${S3_FORCE_PATH_STYLE:-true}" == "true" ]] && style="path"
# Alguns provedores exigem ACL por objeto em vez de política no bucket.
acl=""
[[ "${SITES_PUBLIC_ACL:-false}" == "true" ]] && acl="--acl public-read"

dest="s3://${SITES_BUCKET}/${slug}/"
echo "▶ Publicando $dir em $dest"

# HTML com cache curto (a mudança aparece em ~1 minuto); o resto, 1 dia.
# --delete: arquivo removido da pasta some do site.
docker run --rm \
  -v "$dir:/site:ro" \
  -e AWS_ACCESS_KEY_ID="$SITES_S3_ACCESS_KEY" \
  -e AWS_SECRET_ACCESS_KEY="$SITES_S3_SECRET_KEY" \
  -e AWS_DEFAULT_REGION="$S3_REGION" \
  --entrypoint sh \
  amazon/aws-cli:2.22.0 -c "
    set -e
    aws configure set default.s3.addressing_style $style
    aws --endpoint-url '$S3_ENDPOINT' s3 sync /site '$dest' --delete $acl \
      --exclude '*' --include '*.html' \
      --cache-control 'public, max-age=60'
    aws --endpoint-url '$S3_ENDPOINT' s3 sync /site '$dest' --delete $acl \
      --exclude '*.html' \
      --cache-control 'public, max-age=86400'
  "

echo "✔ No ar em até 1 minuto: https://${slug}.${SITES_DOMAIN}"
