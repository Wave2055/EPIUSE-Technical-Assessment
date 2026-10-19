# Private buckets for the SPA, uploaded avatars (ADR-0013) and database backups (ADR-0023).
# Nothing here is public: CloudFront reads web and avatars through Origin Access Control
# (see the cdn module), and only the instance writes backups.

locals {
  buckets = toset(["web", "avatars", "backups"])
}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets

  bucket = "${var.name}-${each.key}-${var.account_id}"
  # Teardown removes the buckets with their contents (ADR-0021).
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = local.buckets

  bucket                  = aws_s3_bucket.this[each.key].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "this" {
  for_each = local.buckets

  bucket = aws_s3_bucket.this[each.key].id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.this["backups"].id

  rule {
    id     = "expire-database-dumps"
    status = "Enabled"
    filter {
      prefix = "postgres/"
    }
    expiration {
      days = var.backup_retention_days
    }
  }
}
