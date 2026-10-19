variable "region" {
  description = "Region for the state bucket. Budgets are global."
  type        = string
  default     = "eu-west-1"
}

variable "project" {
  description = "Prefix for resource names."
  type        = string
  default     = "epiuse"
}

variable "alert_email" {
  description = "Address that receives budget alerts."
  type        = string
}

variable "create_budgets" {
  description = "Set to false if the budgets were already created in the console."
  type        = bool
  default     = true
}

variable "monthly_budget_usd" {
  description = "Monthly gross spend that triggers alerts (ADR-0021)."
  type        = number
  default     = 25
}
