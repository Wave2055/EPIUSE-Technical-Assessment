variable "name" {
  description = "Prefix for resource names."
  type        = string
}

variable "cidr_block" {
  description = "VPC address range."
  type        = string
  default     = "10.20.0.0/16"
}
