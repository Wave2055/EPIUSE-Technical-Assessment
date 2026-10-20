# One CloudFront distribution serving the SPA, uploaded avatars and the API from a single
# origin (ADR-0016), so the browser needs no CORS and the refresh cookie is same-site.

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# Everything the viewer sent, plus CloudFront's own headers. CloudFront-Viewer-Address is
# what the API rate-limits by, since behind CloudFront and Caddy every request would
# otherwise appear to come from Caddy.
data "aws_cloudfront_origin_request_policy" "all_viewer_and_cloudfront" {
  name = "Managed-AllViewerAndCloudFrontHeaders-2022-06"
}

# The managed SecurityHeadersPolicy sends no Content-Security-Policy, so the SPA had none
# (ADR-0034). The app loads only its own scripts and styles, avatars from itself and
# Gravatar, and talks only to /api, plus presigned uploads straight to the avatar bucket.
# React, Radix and React Flow set inline style attributes, hence 'unsafe-inline' for
# styles only; scripts stay 'self'.
locals {
  content_security_policy = join("; ", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://gravatar.com",
    "font-src 'self' data:",
    "connect-src 'self' https://${var.avatars_bucket.regional_domain}",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ])
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${var.name}-security-headers"
  comment = "CSP plus the usual hardening headers for the SPA and avatars"

  security_headers_config {
    content_security_policy {
      content_security_policy = local.content_security_policy
      override                = true
    }
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
      override = true
    }
  }
}

resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.name}-s3"
  description                       = "CloudFront reads the private web and avatar buckets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# SPA routing: any path without a file extension is an app route, served index.html. This
# runs on the default behaviour only, so API 403s and 404s reach the client unchanged,
# which a distribution-wide custom error response would not allow.
resource "aws_cloudfront_function" "spa_routing" {
  name    = "${var.name}-spa-routing"
  runtime = "cloudfront-js-2.0"
  comment = "Serve index.html for client-side routes"
  publish = true
  code    = file("${path.module}/spa-routing.js")
}

locals {
  web_origin     = "web"
  avatars_origin = "avatars"
  api_origin     = "api"
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  comment             = var.name
  default_root_object = "index.html"
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  # Includes the South African edge locations the assessors are nearest to.
  price_class = "PriceClass_All"

  origin {
    origin_id                = local.web_origin
    domain_name              = var.web_bucket.regional_domain
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  origin {
    origin_id                = local.avatars_origin
    domain_name              = var.avatars_bucket.regional_domain
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  # Plain HTTP to the instance; the security group admits only CloudFront, and the header
  # proves the request came through this distribution (ADR-0016).
  origin {
    origin_id   = local.api_origin
    domain_name = var.api_origin_domain

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    custom_header {
      name  = "x-origin-secret"
      value = var.origin_secret
    }
  }

  default_cache_behavior {
    target_origin_id           = local.web_origin
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_routing.arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = local.api_origin
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_and_cloudfront.id
  }

  # Avatar keys include a random part per upload, so they cache safely (ADR-0013).
  ordered_cache_behavior {
    path_pattern               = "/avatars/*"
    target_origin_id           = local.avatars_origin
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # The default *.cloudfront.net certificate: TLS with no domain to buy (ADR-0016).
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# --- Bucket access -----------------------------------------------------------------------

data "aws_iam_policy_document" "read_through_cloudfront" {
  for_each = {
    web     = var.web_bucket.arn
    avatars = var.avatars_bucket.arn
  }

  statement {
    sid       = "CloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${each.value}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = var.web_bucket.id
  policy = data.aws_iam_policy_document.read_through_cloudfront["web"].json
}

resource "aws_s3_bucket_policy" "avatars" {
  bucket = var.avatars_bucket.id
  policy = data.aws_iam_policy_document.read_through_cloudfront["avatars"].json
}

# The browser posts uploads straight to S3 with a presigned form (ADR-0013), a cross-origin
# request from the site.
resource "aws_s3_bucket_cors_configuration" "avatars" {
  bucket = var.avatars_bucket.id

  cors_rule {
    allowed_methods = ["POST"]
    allowed_origins = ["https://${aws_cloudfront_distribution.this.domain_name}"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}
