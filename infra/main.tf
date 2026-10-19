# The deployment (ADR-0015 to ADR-0018, ADR-0023): one instance running Caddy, the API and
# PostgreSQL, behind one CloudFront distribution that also serves the SPA and avatars.
# Apply infra/bootstrap first; see infra/README.md.

data "aws_caller_identity" "current" {}

module "network" {
  source = "./modules/network"
  name   = var.project
}

module "registry" {
  source = "./modules/registry"
  name   = "${var.project}-api"
}

module "storage" {
  source     = "./modules/storage"
  name       = var.project
  account_id = data.aws_caller_identity.current.account_id
}

# The image tag the instance runs. The deploy workflow sets it before each deploy, and a
# replacement instance starts whatever it names; "none" until the first deploy.
resource "aws_ssm_parameter" "image_tag" {
  name  = "/${var.project}/api-image-tag"
  type  = "String"
  value = "none"

  lifecycle {
    ignore_changes = [value]
  }
}

module "compute" {
  source = "./modules/compute"

  name              = var.project
  instance_type     = var.instance_type
  subnet_id         = module.network.subnet_id
  availability_zone = module.network.availability_zone
  security_group_id = module.network.security_group_id

  ecr_repository_arn = module.registry.repository_arn
  # The version's ARN, so the instance waits for the secret to have a value.
  secret_arn              = aws_secretsmanager_secret_version.app.secret_arn
  image_tag_parameter_arn = aws_ssm_parameter.image_tag.arn
  avatars_bucket_arn      = module.storage.avatars.arn
  backups_bucket_arn      = module.storage.backups.arn

  deploy_files = {
    for name in [
      "docker-compose.yml",
      "Caddyfile",
      "deploy.sh",
      "backup.sh",
      "epiuse-backup.service",
      "epiuse-backup.timer",
    ] : name => file("${path.root}/../deploy/${name}")
  }

  instance_env = {
    AWS_REGION          = var.region
    SECRETS_ARN         = aws_secretsmanager_secret.app.arn
    ECR_REPOSITORY      = module.registry.repository_url
    IMAGE_TAG_PARAMETER = aws_ssm_parameter.image_tag.name
    AVATAR_BUCKET       = module.storage.avatars.id
    BACKUP_BUCKET       = module.storage.backups.id
  }
}

module "cdn" {
  source = "./modules/cdn"

  name              = var.project
  web_bucket        = module.storage.web
  avatars_bucket    = module.storage.avatars
  api_origin_domain = module.compute.public_dns
  origin_secret     = random_password.origin.result
}
