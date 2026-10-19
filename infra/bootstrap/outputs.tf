output "state_bucket" {
  description = "Pass to the main stack: terraform init -backend-config=\"bucket=<this>\"."
  value       = aws_s3_bucket.state.id
}

output "region" {
  value = var.region
}
