# ADR-0021: Accept a credit-funded run rate and commit to teardown

- **Status:** Accepted; run rate and RDS default superseded by [ADR-0023](0023-postgresql-container-on-the-api-instance.md) (teardown commitments stand)
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0015](0015-ec2-docker-for-api-compute.md), [ADR-0017](0017-omit-nat-gateway-use-ssm.md), [ADR-0018](0018-terraform-for-infrastructure.md)

## Context

The brief notes that free cloud hosting options exist, and the deployment was constrained to fit the AWS free tier. That constraint drove [ADR-0015](0015-ec2-docker-for-api-compute.md) (EC2 over App Runner) and [ADR-0017](0017-omit-nat-gateway-use-ssm.md) (no NAT gateway).

The constraint does not hold as cleanly as assumed. The target is a **brand-new AWS account**, and AWS replaced the legacy 12-month free tier in mid-2025 with a credit-based model: new accounts receive roughly $100 in credits (extendable to ~$200 through onboarding activities), valid for about **six months**, rather than 12 months of specified free usage.

So `t3.micro` and `db.t4g.micro` are **not free on this account** — they draw down a finite credit balance. The architecture is still the cheapest sensible option; it is simply funded differently than the phrase "free tier" implies.

**This ADR records a constraint that expires.** Unlike every other record in this stack, it has a deadline.

## Decision

Accept the following estimated run rate, and plan explicitly around its exhaustion.

| Component                      | ~USD/month |
| ------------------------------ | ---------- |
| EC2 `t3.micro` + 8 GB EBS      | 8.20       |
| RDS `db.t4g.micro` + 20 GB gp3 | 14.00      |
| S3 + CloudFront + ECR          | ~0.20      |
| **Total**                      | **~22**    |

Against ~$100 of credit that is roughly **four months** of runway — comfortably longer than an assessment cycle, and the reason no cheaper compromise was made.

Commitments:

1. **Set an AWS Budgets alert** at $25/month and a zero-spend alert, as the first deployment step — before any infrastructure is applied.
2. **Verify actual charges** in the billing console after the first 48 hours, rather than trusting these estimates.
3. **`terraform destroy` once assessment feedback is received.** This is a required step, not a suggestion, and is listed in the README. [ADR-0018](0018-terraform-for-infrastructure.md) exists partly to make it reliable.
4. If the deployment must outlive the credits, apply the documented fallback below rather than silently accruing charges.

**Fallback if credits run low:** collapse PostgreSQL into a second container on the same EC2 instance, with a mounted EBS volume and scheduled `pg_dump` to S3. This removes the RDS line item and drops the run rate to roughly $8/month.

This is deliberately **not** the default. The brief requires that "all modifications must be committed to a remote database", and a managed RDS instance with automated backups and point-in-time recovery is the unambiguous answer to that; a container on the application host is a weaker one, and trades away the backup and recovery guarantees of [ADR-0006](0006-postgresql-via-prisma.md).

## Consequences

### Positive

- Cost is a stated, monitored constraint with alerts, not a surprise on a statement.
- Runway comfortably exceeds the assessment window, so no architectural quality was sacrificed for a saving that was not needed.
- A documented fallback exists, so credit exhaustion is a planned transition rather than an outage.
- Teardown is a one-command operation because of [ADR-0018](0018-terraform-for-infrastructure.md).

### Negative

- **The deployment is not permanent.** A URL in a portfolio or CV will stop working after teardown, so a screencast and screenshots should be captured while it is live.
- The estimates are list-price approximations and exclude data transfer, snapshots and request-level charges; real spend will be somewhat higher.
- Teardown depends on a human remembering. The budget alert is the backstop.
- Credit terms are AWS policy and may change; the numbers here must be verified against the billing console rather than trusted.

## Alternatives considered

- **Keep it running indefinitely and pay ~$22/month.** Simplest, and keeps a live demo URL. Rejected as poor value once assessment is complete.
- **Deploy only when needed, destroy after each session.** Near-zero cost. Rejected: an assessor may follow the URL at any time without warning, and the brief requires it be "easily accessible".
- **Use a genuinely free non-AWS host** (Neon's free Postgres, Fly.io, Render). Would be free indefinitely, and was the original recommendation before AWS was chosen. Rejected at the project owner's direction in favour of an AWS stack.
- **Lambda plus a free external Postgres with an HTTP driver.** Could approach genuinely free in perpetuity. Rejected: contradicts [ADR-0006](0006-postgresql-via-prisma.md) and [ADR-0015](0015-ec2-docker-for-api-compute.md), and would mean reworking the connection model.
