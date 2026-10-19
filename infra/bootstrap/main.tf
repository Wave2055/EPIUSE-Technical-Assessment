# One-off account setup, applied before the main stack (ADR-0018, ADR-0021): the bucket the
# main stack keeps its state in, and the budget alerts that must exist before anything
# that costs money.
#
# This stack keeps local state, because it creates the bucket remote state would live in.
# Its terraform.tfstate holds no secrets, but stays out of git like every state file.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
      Stack     = "bootstrap"
    }
  }
}

data "aws_caller_identity" "current" {}

# --- Terraform state -------------------------------------------------------------------
# Locking uses S3's native lock file (Terraform 1.10+), so no DynamoDB table is needed.

resource "aws_s3_bucket" "state" {
  bucket = "${var.project}-tfstate-${data.aws_caller_identity.current.account_id}"
  # Teardown removes everything (ADR-0021); destroy the main stack first.
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# State holds generated secrets (ADR-0018), so keep history to recover from a bad apply,
# but not forever.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-old-state"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}

# --- Budgets (ADR-0021) ----------------------------------------------------------------

# Tracks gross spend: with credits counted, cost stays at $0 until they run out, and an
# alert on that figure would never fire while it could still help.
resource "aws_budgets_budget" "monthly" {
  count = var.create_budgets ? 1 : 0

  name         = "${var.project}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_types {
    include_credit = false
    include_refund = false
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# Net of credits: fires when spend is no longer covered, e.g. once credits run out, or on a
# legacy free-tier account the first time anything is billed.
resource "aws_budgets_budget" "zero_spend" {
  count = var.create_budgets ? 1 : 0

  name         = "${var.project}-zero-spend"
  budget_type  = "COST"
  limit_amount = "0.01"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
}
