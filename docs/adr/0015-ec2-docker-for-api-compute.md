# ADR-0015: Run the API container on an EC2 t3.micro

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0006](0006-postgresql-via-prisma.md), [ADR-0017](0017-omit-nat-gateway-use-ssm.md), [ADR-0021](0021-credit-funded-run-rate-and-teardown.md)

## Context

The brief requires deployment to a cloud platform and notes free options exist. AWS was selected, with a **hard constraint that the deployment fit the AWS free tier**.

App Runner was the initial choice — it autoscales, needs no load balancer, and connects to RDS over a VPC connector. On checking, **App Runner has no free tier at all.** It bills provisioned container memory continuously, roughly $3–6/month at the 0.25 vCPU / 0.5 GB minimum, even while idle. It cannot satisfy the constraint.

The remaining candidates each fail differently:

- **ECS Fargate + ALB** — the textbook answer, but the ALB alone is ~$16/month before any compute.
- **Lambda + API Gateway** — Lambda's 1M requests/month is _always_ free, and per-request scaling is the best possible fit for "scale independently". But Lambda's concurrency model is hostile to a connection-pooled ORM against `db.t4g.micro` (~81 connections). The standard remedy, RDS Proxy, costs ~$15/month and erases the saving.

## Decision

Run the API as a Docker container on a single **EC2 `t3.micro`** instance, fronted by **Caddy** as a reverse proxy, with the image pulled from **ECR**.

- 750 hours/month of `t3.micro` is the broadest free-tier compute allowance, covering one instance continuously.
- A long-lived process keeps Prisma's connection pool warm and bounded — the model the ORM is designed for, and the one [ADR-0006](0006-postgresql-via-prisma.md) depends on.
- The instance is managed entirely through **SSM Session Manager**, with no SSH key and port 22 closed ([ADR-0017](0017-omit-nat-gateway-use-ssm.md)).
- `user-data` installs Docker and starts the container; deployments replace it via SSM Run Command ([ADR-0019](0019-github-actions-oidc-cicd.md)).

## Consequences

### Positive

- The cheapest compute that runs a conventional long-lived container, with no architectural compromise to the ORM or the connection pool.
- Deploying a plain Docker image keeps the API portable: the same artifact runs locally, on Fargate, or on any other host. **No lock-in was accepted in exchange for the cost saving.**
- No cold starts, so the org chart's first load is not penalised.

### Negative

- **This is the weakest point in the architecture relative to the stated scaling requirement.** A single instance does not autoscale. The API and web tiers still scale independently in the sense that matters — the SPA is on a CDN with no origin capacity concern — but the API tier itself is fixed at one box.
- **A single point of failure, in one availability zone.** An instance or AZ failure takes the API down; recovery is a Terraform re-apply.
- Patching, Docker daemon health and disk usage become this project's responsibility, where App Runner or Fargate would absorb them.
- Deployment is a container swap on a live host, so there is a brief gap rather than a rolling replacement.

The honest summary: **cost constraint beat scalability here**, and the trade is recorded rather than disguised.

## Alternatives considered

- **AWS App Runner.** The original choice and the best architectural fit — managed autoscaling, no load balancer, direct VPC connectivity. Rejected solely because it has no free tier. **The first upgrade to make once cost ceases to bind.**
- **ECS Fargate + ALB.** The right production answer and the strongest story in a technical document: rolling deploys, multi-AZ, autoscaling. Rejected at ~$25–35/month.
- **Lambda + API Gateway.** Genuinely free and the best match for independent scaling. Rejected on the connection-pool mismatch with `db.t4g.micro`; viable only with RDS Proxy (~$15/month) or by moving to a database with an HTTP driver, which would mean reversing [ADR-0006](0006-postgresql-via-prisma.md).
- **Lightsail.** Simple and predictable at $5/month, bundling compute and networking. Rejected: not free-tier eligible, and less Terraform-native than EC2.
