#!/bin/sh
# Dump do Postgres (formato custom, comprimido) → S3, e apaga os mais antigos
# que BACKUP_RETENTION_DAYS. Restaurar: docs/deploy.md.
set -eu

export PGPASSWORD="$(cat "$PGPASSWORD_FILE")"
export AWS_ACCESS_KEY_ID="$(cat "$AWS_ACCESS_KEY_ID_FILE")"
export AWS_SECRET_ACCESS_KEY="$(cat "$AWS_SECRET_ACCESS_KEY_FILE")"
export AWS_DEFAULT_REGION="$BACKUP_S3_REGION"
s3() { aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 "$@"; }

stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
file="/tmp/omnichannel-${stamp}.dump"
echo "[backup] ${stamp}: pg_dump"
pg_dump --format=custom --compress=9 --file="$file"
s3 cp "$file" "s3://${BACKUP_S3_BUCKET}/postgres/omnichannel-${stamp}.dump" --only-show-errors
rm -f "$file"
echo "[backup] enviado: postgres/omnichannel-${stamp}.dump"

# Retenção: apaga dumps mais antigos que o limite.
limit="$(date -u -d "@$(( $(date +%s) - BACKUP_RETENTION_DAYS * 86400 ))" +%Y-%m-%dT%H%M%SZ)"
s3 ls "s3://${BACKUP_S3_BUCKET}/postgres/" | awk '{print $4}' | while read -r name; do
  ts="${name#omnichannel-}"; ts="${ts%.dump}"
  if [ -n "$ts" ] && [ "$ts" \< "$limit" ]; then
    s3 rm "s3://${BACKUP_S3_BUCKET}/postgres/${name}" --only-show-errors
    echo "[backup] removido (retenção): ${name}"
  fi
done
