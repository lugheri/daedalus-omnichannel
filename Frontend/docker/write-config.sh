#!/bin/sh
# Gera o /config.js a partir do ambiente do container (roda antes do nginx).
set -eu
: "${API_URL:?Defina API_URL (ex.: https://api.seudominio.com.br)}"
# Só aceita URL simples: nada de aspas/scripts dentro do JS gerado.
case "$API_URL" in
  http://*|https://*) ;;
  *) echo "API_URL inválida: $API_URL" >&2; exit 1 ;;
esac
if printf '%s' "$API_URL" | grep -q "[\"'<>\\ ]"; then
  echo "API_URL com caracteres inválidos" >&2; exit 1
fi
printf 'window.__APP_CONFIG__ = { apiUrl: "%s" }\n' "$API_URL" > /usr/share/nginx/html/config.js
