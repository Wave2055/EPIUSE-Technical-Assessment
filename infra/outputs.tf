output "site_url" {
  description = "The application, for the assessors."
  value       = "https://${module.cdn.domain_name}"
}

output "region" {
  value = var.region
}

output "instance_id" {
  value = module.compute.instance_id
}

output "ecr_repository_url" {
  value = module.registry.repository_url
}

output "image_tag_parameter" {
  value = aws_ssm_parameter.image_tag.name
}

output "web_bucket" {
  value = module.storage.web.id
}

output "distribution_id" {
  value = module.cdn.distribution_id
}

output "deploy_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN repository variable in GitHub."
  value       = aws_iam_role.deploy.arn
}

output "secret_arn" {
  description = "Holds the seed logins: aws secretsmanager get-secret-value --secret-id <this>."
  value       = aws_secretsmanager_secret.app.arn
}
