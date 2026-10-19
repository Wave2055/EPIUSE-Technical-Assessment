variable "name" {
  description = "Prefix for bucket names."
  type        = string
}

variable "account_id" {
  description = "Suffix that makes the bucket names globally unique."
  type        = string
}

variable "backup_retention_days" {
  description = "How long nightly database dumps are kept (ADR-0023)."
  type        = number
  default     = 14
}
