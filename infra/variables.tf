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

variable "github_repository_ids" {
  description = <<-EOT
    Numeric owner and repository IDs, for repositories whose OIDC tokens use GitHub's
    immutable subject (repo:owner@<owner id>/name@<repo id>:...). Find them with
    `gh api repos/<owner>/<name> --jq '"\(.owner.id) \(.id)"'`. Null if the repository
    still uses the name-only subject.
  EOT
  type        = object({ owner = number, repository = number })
  default     = { owner = 186425095, repository = 1420389825 }
  nullable    = true
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
