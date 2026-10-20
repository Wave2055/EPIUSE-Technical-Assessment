# ADR-0026: Ship the API as a self-migrating image, released by tag

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Jaitin
- **Related:** refines the deployment steps of [ADR-0015](0015-ec2-docker-for-api-compute.md) and [ADR-0019](0019-github-actions-oidc-cicd.md); builds on [ADR-0018](0018-terraform-for-infrastructure.md) and [ADR-0023](0023-postgresql-container-on-the-api-instance.md)

## Context

[ADR-0015](0015-ec2-docker-for-api-compute.md) and [ADR-0019](0019-github-actions-oidc-cicd.md) settled that the API runs as a container on one EC2 instance and is redeployed through SSM. They left open the mechanics, and several of them turned out to matter:

- **Where migrations run.** The database is on a private Docker network on the instance ([ADR-0023](0023-postgresql-container-on-the-api-instance.md)), so a GitHub runner cannot reach it.
- **Where the database URL comes from.** It lives in Secrets Manager. Only the API's own startup code read it, so `prisma migrate deploy` had nothing to connect to.
- **What a replacement instance runs.** Terraform replaces the instance whenever its first-boot script changes. The new instance must come up on the version that was last deployed, not on nothing.
- **How a failed deploy is noticed.** Starting a container is not the same as the application working.

## Decision

**One image, which migrates itself.** The production image (`apps/api/Dockerfile`) is a multi-stage build with production dependencies only, running as the unprivileged `node` user. Its entrypoint applies pending migrations, then execs the API as PID 1 so `SIGTERM` reaches Nest's shutdown hooks. Given arguments, it runs them instead, for one-off jobs such as `prisma db seed`.

**Secrets for every command.** `dist/with-secrets.js` loads the Secrets Manager values into the environment and then runs a command. The entrypoint uses it for migrations and one-off jobs, so the Prisma CLI sees the same configuration as the API. The Prisma CLI is a runtime dependency for this reason, and it is most of the image's weight.

**Released by tag.** CI pushes images tagged with the commit SHA to an ECR repository with **immutable tags**. The tag to run lives in an SSM parameter (`/epiuse/api-image-tag`). `deploy/deploy.sh` reads the parameter and builds the instance's root-only `.env` from Secrets Manager. It then logs in to ECR, runs `docker compose up -d --wait`, and prunes old images. Both the deploy workflow (through SSM Run Command) and the instance's first boot run the same script, so a replacement instance starts whatever was last deployed.

**Health decides success.** The API's `HEALTHCHECK` calls `/api/health`, which queries the database. Caddy's own health check calls the same route through the proxy. `--wait` returns only when every service is healthy, so a failed migration or startup fails the deploy step.

**Tested in CI.** A CI job builds the image and runs it against a throwaway PostgreSQL. Migrations must apply from inside the container, the API must pass its own health check, and the seed must run. This catches a file left out of the image, which the source-level jobs cannot see.

## Consequences

### Positive

- Migrations always run against the exact code that needs them, in the network where the database lives.
- A deploy is one SSM call with one input, the tag; rolling back is the same call with an older tag.
- A broken image fails in CI or in the deploy step, not silently in production.
- No credentials are baked into the image; everything is read at boot through the instance role.

### Negative

- **Migrations run on every start**, including restarts. Prisma makes that a fast no-op when nothing is pending, but a destructive migration still applies the moment its image starts, with no separate approval step.
- The image is about 950 MB uncompressed (about 200 MB compressed), mostly the Prisma CLI kept for self-migration.
- Immutable tags mean a re-run cannot overwrite an image; the workflow reuses the existing one instead of rebuilding it.

## Alternatives considered

- **A separate migration image or job.** Keeps the runtime image small and makes migrations an explicit step. Rejected: two images to build, tag and keep in step, for a single instance.
- **Migrations from the GitHub runner.** Matches the original wording of [ADR-0019](0019-github-actions-oidc-cicd.md), but the database is unreachable from outside the instance by design ([ADR-0023](0023-postgresql-container-on-the-api-instance.md)).
- **Migrations inside the API's startup code.** Prisma has no programmatic migration API, so it would mean shelling out from Nest anyway, with less control over failure.
- **A mutable `latest` tag.** Simpler to deploy, but a replacement instance could start a different build from the one tested, and rollback would mean rebuilding.
