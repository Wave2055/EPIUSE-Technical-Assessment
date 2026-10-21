# syntax=docker/dockerfile:1
#
# The "edge" of the end-to-end stack: the production web build behind Caddy, configured to
# do what CloudFront does in production (ADR-0016, ADR-0027, ADR-0034). Build from the
# repository root:
#
#   docker build -f e2e/edge.Dockerfile .

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter "@epiuse/web..." --filter "epiuse-employee-hierarchy"

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# Exactly the build the deploy workflow publishes to S3.
RUN pnpm --filter @epiuse/shared build && pnpm --filter @epiuse/web build

FROM caddy:2.10-alpine
COPY e2e/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
