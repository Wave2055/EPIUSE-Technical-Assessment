#!/bin/sh
#
# Container entrypoint. With no arguments: apply pending migrations, then start the API as
# PID 1 so it receives SIGTERM directly and shuts down cleanly. With arguments: run them
# instead, with Secrets Manager values loaded, e.g. the one-off seed after the first deploy:
#
#   docker run --rm -e SECRETS_ARN=... -e SEED_ADMIN_PASSWORD=... -e SEED_VIEWER_PASSWORD=... \
#     epiuse-api prisma db seed
#
# Set RUN_MIGRATIONS=false to start without migrating.

set -eu

if [ "$#" -gt 0 ]; then
  exec node dist/with-secrets.js "$@"
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node dist/with-secrets.js prisma migrate deploy
fi

exec node dist/main.js
