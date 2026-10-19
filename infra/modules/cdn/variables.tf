variable "name" {
  description = "Prefix for resource names."
  type        = string
}

variable "web_bucket" {
  description = "The SPA bucket, from the storage module."
  type = object({
    id              = string
    arn             = string
    regional_domain = string
  })
}

variable "avatars_bucket" {
  description = "The uploaded-avatar bucket, from the storage module."
  type = object({
    id              = string
    arn             = string
    regional_domain = string
  })
}

variable "api_origin_domain" {
  description = "DNS name of the instance's Elastic IP."
  type        = string
}

variable "origin_secret" {
  description = "Header value the API requires on every request (ADR-0016)."
  type        = string
  sensitive   = true
}
