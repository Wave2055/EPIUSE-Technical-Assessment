# ADR-0019: Deploy from GitHub Actions using OIDC role assumption

- **Status:** Accepted; release mechanics refined by [ADR-0026](0026-self-migrating-api-image-released-by-tag.md), trust policy amended by [ADR-0029](0029-trust-githubs-immutable-oidc-subject.md)
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0015](0015-ec2-docker-for-api-compute.md), [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md), [ADR-0018](0018-terraform-for-infrastructure.md)

## Context

The brief requires a git repository and a deployed URL, but says nothing about how code reaches the deployment. Two deployables ([ADR-0002](0002-separate-api-and-web-deployables.md)) with different targets — a container on EC2 and static assets on S3 — means a manual process has several steps and a forgettable one at the end (CloudFront invalidation, [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md)).

The important sub-decision is **how the pipeline authenticates to AWS**. The default approach is an IAM user with long-lived access keys stored as repository secrets — a standing credential with deployment rights, sitting in a third-party system, that nothing rotates.

## Decision

Use **GitHub Actions**, authenticating to AWS via **OIDC role assumption**. No long-lived AWS keys exist anywhere in the repository or its settings.

An IAM OIDC identity provider trusts GitHub's token issuer, and the deployment role's trust policy is scoped to this specific repository and branch. The workflow receives short-lived credentials per run.

Pipeline:

- **On every push and PR:** lint → typecheck → unit tests → integration tests against Testcontainers Postgres ([ADR-0020](0020-test-database-triggers-with-testcontainers.md)) → build both apps.
- **On merge to `main`:**
  - API — build the image, push to ECR, trigger a container pull-and-restart on the instance via **SSM Run Command** (no SSH, consistent with [ADR-0017](0017-omit-nat-gateway-use-ssm.md)).
  - Web — build the SPA, `aws s3 sync` to the bucket, then **invalidate the CloudFront distribution**.
  - Database — run `prisma migrate deploy` before the new container starts.

Terraform is **not** run automatically on merge; infrastructure changes are applied deliberately after review of a plan.

## Consequences

### Positive

- **No long-lived cloud credentials to leak or rotate** — the main reason for this design.
- Cache invalidation is part of the pipeline, so the most common stale-asset bug cannot happen through forgetfulness.
- Migrations run in a defined order relative to the container swap, rather than by hand at an arbitrary moment.
- Tests gate the deploy, so the hierarchy invariants ([ADR-0008](0008-defence-in-depth-cycle-prevention.md)) are verified before anything ships.
- The workflow file doubles as executable documentation of the deployment process.

### Negative

- Deployment is a container swap on a single host ([ADR-0015](0015-ec2-docker-for-api-compute.md)), so there is a short outage. A rolling deploy needs the Fargate or App Runner upgrade path.
- `prisma migrate deploy` runs against the live database with no automated rollback; a destructive migration is not recoverable without a snapshot restore.
- The OIDC trust relationship is fiddly to configure correctly, and a too-broad trust policy would let other repositories assume the deployment role.
- Terraform remaining manual means infrastructure and application code can drift apart.

## Alternatives considered

- **IAM user with access keys in repository secrets.** The common approach and much quicker to set up. Rejected: a permanent, unrotated deployment credential stored off-platform is a standing risk for no benefit.
- **Manual deploy script run locally.** Zero CI configuration. Rejected: no test gate, no reproducibility, and deployment ability tied to one machine's configuration.
- **Terraform applied automatically on merge.** Fully continuous. Rejected: `terraform apply` on a merge can destroy and recreate stateful resources; infrastructure changes warrant reading a plan first.
- **AWS CodePipeline / CodeBuild.** Native, avoids the OIDC setup, and credentials never leave AWS. Rejected: more infrastructure to define and pay for when the repository already lives on GitHub.
