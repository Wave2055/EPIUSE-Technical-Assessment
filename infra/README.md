# Infrastructure

Terraform for the AWS deployment in `eu-west-1` ([ADR-0018](../docs/adr/0018-terraform-for-infrastructure.md)). One `t3.micro` runs Caddy, the API and PostgreSQL ([ADR-0015](../docs/adr/0015-ec2-docker-for-api-compute.md), [ADR-0023](../docs/adr/0023-postgresql-container-on-the-api-instance.md)), and one CloudFront distribution serves the SPA, avatars and the API from a single URL ([ADR-0016](../docs/adr/0016-single-cloudfront-distribution-dual-origin.md)).

| Path               | What it holds                                                                   |
| ------------------ | ------------------------------------------------------------------------------- |
| `bootstrap/`       | Applied once: the Terraform state bucket and the budget alerts. Local state.    |
| `modules/network`  | VPC, one public subnet, security group open to CloudFront only. No NAT gateway. |
| `modules/compute`  | The instance, its role, Elastic IP, database volume and first-boot script.      |
| `modules/storage`  | Private buckets for the SPA, avatars and database backups.                      |
| `modules/registry` | ECR repository for the API image.                                               |
| `modules/cdn`      | CloudFront, its SPA routing function and the bucket policies.                   |
| `secrets.tf`       | Generated credentials, stored in Secrets Manager.                               |
| `github.tf`        | GitHub's OIDC provider and the role the deploy workflow assumes.                |

The instance runs the files in [`deploy/`](../deploy), which Terraform embeds in its first-boot script. Changing any of them, or the script, **replaces the instance** on the next apply: a few minutes of downtime, with the database volume reattached and its data intact.

## Prerequisites

- An AWS account with an admin login for the CLI (`aws sts get-caller-identity` works).
- Terraform 1.10 or later, and Docker.

## 1. Bootstrap (once)

```bash
cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars   # set alert_email
terraform init
terraform apply
```

## 2. Apply the stack

```bash
cd infra
terraform init -backend-config="bucket=$(terraform -chdir=bootstrap output -raw state_bucket)"
terraform plan -out=tfplan      # read it
terraform apply tfplan
```

The instance boots and waits: nothing runs until an image is deployed.

## 3. First deploy

After this, the deploy workflow does the same on every merge to `main`.

```bash
cd infra
REPO=$(terraform output -raw ecr_repository_url)
INSTANCE=$(terraform output -raw instance_id)
TAG=$(git rev-parse --short HEAD)

# API image
aws ecr get-login-password | docker login --username AWS --password-stdin "${REPO%%/*}"
docker build -f ../apps/api/Dockerfile -t "$REPO:$TAG" ..
docker push "$REPO:$TAG"
aws ssm put-parameter --overwrite --name "$(terraform output -raw image_tag_parameter)" --value "$TAG"
aws ssm send-command --instance-ids "$INSTANCE" --document-name AWS-RunShellScript \
  --parameters 'commands=["/opt/epiuse/deploy.sh"]'

# Starter data and the two logins, once. Passwords come from the secret.
aws ssm send-command --instance-ids "$INSTANCE" --document-name AWS-RunShellScript \
  --parameters 'commands=["cd /opt/epiuse && docker compose run --rm api prisma db seed"]'

# SPA
(cd .. && pnpm install --frozen-lockfile && pnpm build)
aws s3 sync ../apps/web/dist "s3://$(terraform output -raw web_bucket)" --delete
aws cloudfront create-invalidation --distribution-id "$(terraform output -raw distribution_id)" --paths '/*'

terraform output -raw site_url
```

The seeded logins are `admin@example.com` and `viewer@example.com`:

```bash
aws secretsmanager get-secret-value --secret-id "$(terraform output -raw secret_arn)" \
  --query SecretString --output text | jq '{SEED_ADMIN_PASSWORD, SEED_VIEWER_PASSWORD}'
```

## Operating it

```bash
aws ssm start-session --target "$(terraform output -raw instance_id)"   # a shell, no SSH

sudo cat /var/log/epiuse-bootstrap.log                     # first boot
cd /opt/epiuse && sudo docker compose ps                    # service health
sudo docker compose logs --tail=100 api                     # API logs
sudo ./backup.sh                                            # backup now, before anything risky
```

Backups run nightly to the backups bucket and are kept for 14 days. The restore command is at the top of [`deploy/backup.sh`](../deploy/backup.sh).

## Teardown

Required once the assessment is over ([ADR-0021](../docs/adr/0021-credit-funded-run-rate-and-teardown.md)). This deletes the database and its backups.

```bash
cd infra && terraform destroy
cd bootstrap && terraform destroy
```
