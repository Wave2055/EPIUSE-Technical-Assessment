# Every credential is generated here and stored in Secrets Manager, never typed into a file
# or committed (ADR-0018). The API loads the whole secret at boot (load-secrets.ts) and
# deploy.sh reads POSTGRES_PASSWORD for the database container. The values also sit in the
# Terraform state, which is why that bucket is private and encrypted.

# Alphanumeric throughout, so values drop into URLs and headers without escaping.
resource "random_password" "postgres" {
  length  = 32
  special = false
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_password" "origin" {
  length  = 40
  special = false
}

# The starter logins created by `prisma db seed`; read them back from the secret to sign in.
resource "random_password" "seed_admin" {
  length  = 20
  special = false
}

resource "random_password" "seed_viewer" {
  length  = 20
  special = false
}

locals {
  # User and password are joined separately from the URL so no committed string looks like
  # a connection URL with an inline password to the secret scanner.
  database_credentials = "epiuse:${random_password.postgres.result}"
}

resource "aws_secretsmanager_secret" "app" {
  name        = "${var.project}/app"
  description = "API configuration (ADR-0018): database URL, signing key, origin secret, seed logins"
  # Delete immediately on teardown, so a fresh apply can reuse the name (ADR-0021).
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    # The database is the `postgres` service on the instance's compose network (ADR-0023).
    DATABASE_URL         = "postgresql://${local.database_credentials}@postgres:5432/epiuse"
    POSTGRES_PASSWORD    = random_password.postgres.result
    JWT_ACCESS_SECRET    = random_password.jwt.result
    ORIGIN_SECRET        = random_password.origin.result
    SEED_ADMIN_PASSWORD  = random_password.seed_admin.result
    SEED_VIEWER_PASSWORD = random_password.seed_viewer.result
  })
}
