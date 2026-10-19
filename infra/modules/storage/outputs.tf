output "web" {
  description = "The SPA bucket."
  value = {
    id              = aws_s3_bucket.this["web"].id
    arn             = aws_s3_bucket.this["web"].arn
    regional_domain = aws_s3_bucket.this["web"].bucket_regional_domain_name
  }
}

output "avatars" {
  description = "The uploaded-avatar bucket."
  value = {
    id              = aws_s3_bucket.this["avatars"].id
    arn             = aws_s3_bucket.this["avatars"].arn
    regional_domain = aws_s3_bucket.this["avatars"].bucket_regional_domain_name
  }
}

output "backups" {
  description = "The database backup bucket."
  value = {
    id  = aws_s3_bucket.this["backups"].id
    arn = aws_s3_bucket.this["backups"].arn
  }
}
