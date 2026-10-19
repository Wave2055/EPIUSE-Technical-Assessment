#!/usr/bin/env bash
#
# Logical backup of the database to S3 (ADR-0023). Run nightly by epiuse-backup.timer, or by
# hand before anything risky. The bucket expires old dumps through a lifecycle rule.
#
# Restore into the running container:
#   aws s3 cp s3://$BACKUP_BUCKET/postgres/<file>.dump - \
#     | docker compose exec -T postgres pg_restore -U epiuse -d epiuse --clean --if-exists

set -euo pipefail

cd "$(dirname "$0")"
# The same root-only .env that compose reads, for BACKUP_BUCKET.
set -a
# shellcheck source=/dev/null
. ./.env
set +a
: "${BACKUP_BUCKET:?Set BACKUP_BUCKET in .env}"

key="postgres/epiuse-$(date -u +%Y%m%dT%H%M%SZ).dump"
dump=$(mktemp)
trap 'rm -f "$dump"' EXIT

# Dump fully before uploading, so a failed pg_dump never leaves a truncated file in S3.
docker compose exec -T postgres pg_dump -U epiuse -d epiuse --format=custom > "$dump"
aws s3 cp "$dump" "s3://${BACKUP_BUCKET}/${key}" --only-show-errors

echo "Backed up to s3://${BACKUP_BUCKET}/${key}"
