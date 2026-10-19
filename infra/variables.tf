variable "region" {
  description = "Region for everything except CloudFront, which is global."
  type        = string
  default     = "eu-west-1"
}

variable "project" {
  description = "Prefix for resource names."
  type        = string
  default     = "epiuse"
}

variable "github_repository" {
  description = "owner/name of the repository whose main branch may deploy (ADR-0019)."
  type        = string
  default     = "Wave2055/EPIUSE-Technical-Assessment"
}

variable "instance_type" {
  description = "EC2 instance type (ADR-0015)."
  type        = string
  default     = "t3.micro"
}

variable "create_github_oidc_provider" {
  description = "Set to false if the account already has GitHub's OIDC provider (one is allowed per account)."
  type        = bool
  default     = true
}
