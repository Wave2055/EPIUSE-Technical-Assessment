# syntax=docker/dockerfile:1
#
# Production image for the API (ADR-0015). Build from the repository root, because the API
# depends on the @epiuse/shared workspace package (ADR-0003):
#
#   docker build -f apps/api/Dockerfile -t epiuse-api .
#
# On start the container applies pending migrations, then runs the API. Configuration comes
# from the environment, or from Secrets Manager when SECRETS_ARN is set (ADR-0018).

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
# pnpm's version comes from "packageManager" in the root package.json.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# --- Build: install, compile shared and api, then assemble a production-only tree -------
FROM base AS build

# Dependencies first, so source edits do not invalidate the install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# The api's postinstall runs `prisma generate`, which needs the schema and config.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN pnpm install --frozen-lockfile --filter "@epiuse/api..." --filter "epiuse-employee-hierarchy"

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @epiuse/shared build && pnpm --filter @epiuse/api build

# A self-contained copy of the api with production dependencies only, @epiuse/shared
# included. The build output and Prisma files are copied explicitly rather than trusting
# the package's publish list. The Prisma CLI is most of the image's weight; it is kept so
# the container can migrate itself on start, with no separate migration image to ship.
RUN pnpm --filter @epiuse/api deploy --prod --legacy /out \
  && cd /out && rm -rf dist prisma src test Dockerfile nest-cli.json tsconfig*.json vitest.config*.ts \
  && cd /repo \
  && cp -r apps/api/dist apps/api/prisma apps/api/prisma.config.ts /out/ \
  # The seed runs from TypeScript source (via tsx) and imports the password hasher and the
  # generated client from src/.
  && mkdir -p /out/src && cp -r apps/api/src/auth apps/api/src/generated /out/src/ \
  && cp apps/api/docker-entrypoint.sh /out/

# --- Runtime ------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

# OpenSSL for Prisma's schema engine. The database is a sibling container on the same
# host (ADR-0023), so its traffic never leaves the compose network and needs no TLS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  PORT=3000 \
  PATH=/app/node_modules/.bin:$PATH

WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node

EXPOSE 3000

# /api/health checks the database too, and is exempt from the origin secret (ADR-0016).
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

ENTRYPOINT ["./docker-entrypoint.sh"]
