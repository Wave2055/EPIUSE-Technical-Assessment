# The API image repository (ADR-0015, ADR-0019).

resource "aws_ecr_repository" "api" {
  name = var.name
  # Each deploy pushes a commit SHA tag, which must never be overwritten.
  image_tag_mutability = "IMMUTABLE"
  # Teardown removes the repository with its images (ADR-0021).
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Storage is billed per GB; ten images is plenty to roll back with.
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the ten most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
