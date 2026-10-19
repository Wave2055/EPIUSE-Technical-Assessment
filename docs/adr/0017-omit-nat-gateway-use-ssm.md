# ADR-0017: Omit the NAT gateway; place EC2 in a public subnet and administer via SSM

- **Status:** Accepted; private subnet tier made unnecessary by [ADR-0023](0023-postgresql-container-on-the-api-instance.md)
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0015](0015-ec2-docker-for-api-compute.md), [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md), [ADR-0021](0021-credit-funded-run-rate-and-teardown.md)

## Context

The textbook AWS network layout places application compute in private subnets with a NAT gateway for outbound access, and the database in isolated private subnets.

A **NAT gateway costs roughly $32/month** before data processing charges — more than every other component of this system combined ([ADR-0021](0021-credit-funded-run-rate-and-teardown.md)). Under a hard free-tier/credit constraint it is the single most expensive thing that could be added, and it exists only to let the instance reach the internet outbound.

What does the API actually need outbound? Very little. It pulls its image from ECR, reads secrets from Secrets Manager, and talks to SSM. It never calls Gravatar — avatar URLs are resolved into DTOs and fetched by the _browser_ ([ADR-0013](0013-avatar-resolution-chain.md)). It never uploads to S3 — that is a presigned `PUT` direct from the browser. **The API has no outbound dependency on the public internet.**

## Decision

Build a two-AZ VPC with **no NAT gateway**:

- **Public subnets** — the EC2 instance with an Elastic IP, for outbound ECR/SSM access via the internet gateway. Its security group accepts `:80` only from CloudFront's origin-facing prefix list ([ADR-0016](0016-single-cloudfront-distribution-dual-origin.md)). **Port 22 is not open.**
- **Private subnets** — RDS, with a security group accepting `:5432` only from the EC2 instance's security group. Not publicly accessible, no internet route.
- **Administrative access via SSM Session Manager**, over the instance's IAM role. No SSH key is created or distributed.

## Consequences

### Positive

- Saves ~$32/month, which is the difference between this deployment being viable on credits and not.
- **No SSH key to generate, distribute, rotate or leak**, and no port 22 exposed to the internet — materially _better_ security than the conventional bastion-host pattern it replaces.
- Session Manager logs every administrative session to CloudTrail, giving auditable shell access.
- The database remains genuinely private, which is the part of the textbook layout that carries the real security value.

### Negative

- **The instance is in a public subnet with a public IP**, which is the part of the textbook layout being given up. The exposure is reduced to the security group, so a security-group misconfiguration becomes directly internet-facing rather than being caught by a second layer. This is the real cost of the decision.
- Outbound traffic to ECR and Secrets Manager traverses the internet gateway rather than staying on the AWS backbone. VPC endpoints would fix this, but interface endpoints are themselves billed hourly — the same cost problem in smaller form.
- A reviewer applying a standard AWS Well-Architected checklist will flag "application tier in a public subnet". Hence this record.

## Alternatives considered

- **NAT gateway with EC2 in private subnets.** The correct production topology. Rejected purely on cost; **the first thing to add when the budget allows.**
- **NAT instance** (a second `t3.micro` doing NAT). Roughly a tenth of the cost of a managed NAT. Rejected: consumes the free-tier EC2 hours needed by the application itself, and becomes another single point of failure to operate.
- **VPC endpoints for ECR, S3 and SSM, no internet access at all.** The most secure option and genuinely attractive — the S3 gateway endpoint is free. Rejected because ECR and Secrets Manager require _interface_ endpoints at ~$7/month each, which reintroduces the cost problem.
- **IPv6-only with an egress-only internet gateway.** Egress-only gateways are free. Rejected: ECR and several AWS endpoints have incomplete IPv6 support, making this fragile for a marginal saving.
