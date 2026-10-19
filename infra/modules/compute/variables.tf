variable "name" {
  description = "Prefix for resource names."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type (ADR-0015)."
  type        = string
  default     = "t3.micro"
}

variable "root_volume_gb" {
  description = "Root volume size: OS, Docker images, swap and logs."
  type        = number
  default     = 8
}

variable "data_volume_gb" {
  description = "Size of the PostgreSQL data volume (ADR-0023)."
  type        = number
  default     = 5
}

variable "subnet_id" {
  type = string
}

variable "availability_zone" {
  description = "Must match the subnet's, so the data volume can attach."
  type        = string
}

variable "security_group_id" {
  type = string
}

variable "ecr_repository_arn" {
  type = string
}

variable "secret_arn" {
  type = string
}

variable "image_tag_parameter_arn" {
  type = string
}

variable "avatars_bucket_arn" {
  type = string
}

variable "backups_bucket_arn" {
  type = string
}

variable "deploy_files" {
  description = "Files written to /opt/epiuse, by name: the compose file, Caddyfile and scripts in deploy/."
  type        = map(string)
}

variable "instance_env" {
  description = "Settings written to /opt/epiuse/instance.env for deploy.sh. No secrets."
  type        = map(string)
}

variable "compose_version" {
  description = "Docker Compose release installed at first boot."
  type        = string
  default     = "v5.6.0"
}

variable "compose_sha256" {
  description = "SHA-256 of docker-compose-linux-x86_64 for compose_version, from the release page."
  type        = string
  default     = "40343e21ca777173e69cff5dbafeb37c6f81f3b0d57d9e597f036e95eb63e76a"
}
