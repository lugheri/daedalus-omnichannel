#!/bin/sh
# Agenda o backup no cron (BACKUP_CRON, padrão 03:00) e roda um na subida,
# para confirmar logo que credenciais e bucket funcionam.
set -eu
echo "${BACKUP_CRON} /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
/usr/local/bin/backup.sh
exec crond -f -l 8
