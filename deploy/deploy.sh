#!/usr/bin/env bash
#
# Starts or updates the stack on the instance, from /opt/epiuse. Run by user-data at first
# boot and by the deploy workflow through SSM Run Command (ADR-0019).
#
# The image tag comes from an SSM parameter the deploy workflow sets, so a replacement
# instance comes up on whatever was last deployed. Secrets come from Secrets Manager through
# the instance role, and the .env built from them is readable by root only.

set -euo pipefail
cd "$(dirname "$0")"
# SSM Run Command and cloud-init can run this without HOME, where docker keeps its login.
export HOME="${HOME:-/root}"

# Written by user-data from Terraform: AWS_REGION, SECRETS_ARN, ECR_REPOSITORY,
# IMAGE_TAG_PARAMETER, AVATAR_BUCKET and BACKUP_BUCKET.
set -a
# shellcheck source=/dev/null
. ./instance.env
set +a

tag=$(aws ssm get-parameter --name "$IMAGE_TAG_PARAMETER" --query Parameter.Value --output text)
if [ "$tag" = none ]; then
  echo "No image deployed yet: push one to ECR and set $IMAGE_TAG_PARAMETER to its tag."
  exit 0
fi

postgres_password=$(aws secretsmanager get-secret-value --secret-id "$SECRETS_ARN" \
  --query SecretString --output text | jq -er .POSTGRES_PASSWORD)

umask 077
cat > .env <<EOF
API_IMAGE=${ECR_REPOSITORY}:${tag}
POSTGRES_PASSWORD=${postgres_password}
SECRETS_ARN=${SECRETS_ARN}
AWS_REGION=${AWS_REGION}
AVATAR_BUCKET=${AVATAR_BUCKET}
BACKUP_BUCKET=${BACKUP_BUCKET}
EOF

# ECR logins last 12 hours, so log in on every deploy rather than once at boot.
aws ecr get-login-password | docker login --username AWS --password-stdin "${ECR_REPOSITORY%%/*}"
docker compose pull --quiet
# Migrations run as the API starts; --wait fails the deploy if any service is unhealthy.
docker compose up -d --wait --remove-orphans
# Superseded images would otherwise fill the 8 GB root volume.
docker image prune -af

echo "Running ${ECR_REPOSITORY}:${tag}"
