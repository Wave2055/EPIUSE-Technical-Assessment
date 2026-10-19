output "instance_id" {
  value = aws_instance.this.id
}

output "instance_arn" {
  value = aws_instance.this.arn
}

output "public_dns" {
  description = "The Elastic IP's DNS name, used as CloudFront's API origin."
  value       = aws_eip.instance.public_dns
}
