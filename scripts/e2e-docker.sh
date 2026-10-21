#!/usr/bin/env bash
# End-to-end tests against a full Docker build of the application (ADR-0035):
#
#   1. builds the production API image and web build, and starts them on PostgreSQL behind
#      a CloudFront stand-in (e2e/docker-compose.yml);
#   2. migrates and seeds the database from inside the API image, as production does;
#   3. runs every Playwright spec in apps/web/e2e against http://localhost:$E2E_PORT;
#   4. tears the stack down, whatever happened.
#
# Secrets are random per run unless already set, and never written to disk. Extra arguments go to Playwright,
# e.g. `pnpm test:e2e:docker --grep viewer`. Set E2E_KEEP=1 to leave the stack running.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
compose=(docker compose -f "$root/e2e/docker-compose.yml")
random() { node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('base64url'))"; }

export E2E_PORT="${E2E_PORT:-8080}"
export E2E_JWT_SECRET="${E2E_JWT_SECRET:-$(random)$(random)}"
export E2E_ORIGIN_SECRET="${E2E_ORIGIN_SECRET:-$(random)}"
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-admin-$(random)}"
export E2E_VIEWER_PASSWORD="${E2E_VIEWER_PASSWORD:-viewer-$(random)}"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "--- API logs ---"
    "${compose[@]}" logs --no-color --tail 80 api || true
  fi
  if [ "${E2E_KEEP:-0}" != 1 ]; then
    "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

# A stack left by an earlier run (E2E_KEEP=1, or a killed run) would keep its database,
# and the seed below skips a database that already has employees, so its passwords would
# not match this run's. Always start from nothing.
"${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true

echo "Building and starting the stack…"
"${compose[@]}" up -d --build --wait

echo "Seeding…"
"${compose[@]}" exec -T api prisma db seed

echo "Running Playwright…"
cd "$root/apps/web"
E2E_BASE_URL="http://localhost:$E2E_PORT" pnpm exec playwright test "$@"
