# pg_dump (mesma versão do servidor) + cliente S3 + cron.
FROM postgres:18-alpine
RUN apk add --no-cache aws-cli
COPY --chmod=755 backup.sh entrypoint.sh /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
