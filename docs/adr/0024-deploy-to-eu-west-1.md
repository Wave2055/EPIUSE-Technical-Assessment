# ADR-0024: Deploy to eu-west-1 (Ireland)

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Jaitin
- **Related:** [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md), [ADR-0021](0021-credit-funded-run-rate-and-teardown.md), [ADR-0023](0023-postgresql-container-on-the-api-instance.md)

## Context

No earlier record chose a region. The code defaulted to `af-south-1` (Cape Town), the obvious choice for a South African assessor, but three things count against it for this deployment:

- **It is an opt-in region.** A new account has to enable it before anything can be created there, and it is not clear that every account on AWS's credit-based free plan can.
- **It is one of the dearer regions.** Compute and storage list prices are noticeably above those in the large European and US regions, and every dollar matters on a fixed credit balance ([ADR-0021](0021-credit-funded-run-rate-and-teardown.md)).
- **Most of the latency it would save is already saved.** The SPA is served from CloudFront's edge locations, including those in South Africa ([ADR-0016](0016-single-cloudfront-distribution-dual-origin.md)). Only `/api/*` requests travel to the origin region.

## Decision

Deploy everything regional to **eu-west-1 (Ireland)**. CloudFront stays global. `AWS_REGION` defaults to `eu-west-1` in the API, the compose file and the Terraform variables.

## Consequences

### Positive

- No opt-in step, so the account works on the first `terraform apply`.
- Lower run rate for the same instance, volume and storage.
- A mature region: every service in the stack is available, with no feature gaps to work around.

### Negative

- API calls from South Africa cross to Ireland: a round trip of roughly 160–180 ms, against 20–40 ms within the country. Page loads are unaffected because the SPA comes from the edge, but every data request pays it.
- Data about South African employees is stored in the EU. That is immaterial for seeded demonstration data, but a real deployment would need to consider POPIA's rules on cross-border transfers.

## Alternatives considered

- **af-south-1 (Cape Town).** Lowest latency for South African users. Rejected for the opt-in friction and higher prices above, given that the edge already serves the static half of the application.
- **us-east-1 (N. Virginia).** Usually the cheapest region, but only by cents a month at this scale, at the cost of a much longer round trip from South Africa.
