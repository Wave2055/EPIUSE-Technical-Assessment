# ADR-0023: Run PostgreSQL in a container on the API instance

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Jaitin
- **Related:** supersedes the RDS hosting in [ADR-0006](0006-postgresql-via-prisma.md) and the run rate in [ADR-0021](0021-credit-funded-run-rate-and-teardown.md); amends [ADR-0017](0017-omit-nat-gateway-use-ssm.md) and [ADR-0018](0018-terraform-for-infrastructure.md); builds on [ADR-0015](0015-ec2-docker-for-api-compute.md)

## Context

[ADR-0006](0006-postgresql-via-prisma.md) hosted PostgreSQL on Amazon RDS. [ADR-0021](0021-credit-funded-run-rate-and-teardown.md) priced the deployment at about $22 a month and documented a fallback, PostgreSQL in a container on the EC2 instance. It kept that fallback out of the default because a managed database was the strongest reading of the brief's _"all modifications must be committed to a remote database"_.

Two things have changed since:

1. **The estimate was low.** It left out AWS's charge for public IPv4 addresses (about $3.65 a month for the instance's Elastic IP) and Secrets Manager ($0.40 a month). The real run rate with RDS is nearer **$26 a month**, and RDS is more than half of it.
2. **The goal changed.** The project owner asked for the cheapest server that does the job. On a new account the deployment is paid from a fixed credit balance with a six-month expiry ([ADR-0021](0021-credit-funded-run-rate-and-teardown.md)), so every dollar saved is runway.

The question is whether dropping RDS still meets the brief. The brief forbids mocked data, hard-coded values and local files: the application must persist every change in a real database it reaches over the network, not in the browser or the repository. A PostgreSQL server on a cloud host does that. What the change gives up is a **managed** database, not a **remote** one. The cost of that is recorded below rather than hidden.

## Decision

Run **PostgreSQL 17 as a container** (`postgres:17-alpine`) in the same Compose project as the API and Caddy on the EC2 instance ([ADR-0015](0015-ec2-docker-for-api-compute.md)), and drop RDS.

- **Durable storage.** Data lives on a dedicated 5 GB gp3 EBS volume, separate from the root volume and mounted by user-data. Replacing the instance, which Terraform does when user-data changes, leaves the database intact.
- **Not reachable from outside.** The container publishes no port. Only the API reaches it, over the Compose network, and no security group opens `5432`.
- **No TLS.** Database traffic never leaves the host's Docker network, so the RDS certificate bundle is removed from the API image.
- **Secrets stay generated.** Terraform still generates the database password into Secrets Manager ([ADR-0018](0018-terraform-for-infrastructure.md)). The API reads `DATABASE_URL` from the secret as before. The PostgreSQL container gets the password from the instance's root-only `.env`, written from the same secret.
- **Nightly backups.** A systemd timer runs `deploy/backup.sh` every night. It writes a `pg_dump` (custom format) to an S3 bucket, and a lifecycle rule keeps 14 days of dumps. The dump completes before upload, so a failed run never leaves a truncated backup. The restore command sits at the top of the script.
- **Sized for 1 GB of memory.** `max_connections=40` and `shared_buffers=128MB` suit an instance shared with the API, and user-data adds a 1 GB swap file to absorb the brief memory peak while migrations run at startup.

| Component                                | ~USD/month |
| ---------------------------------------- | ---------- |
| EC2 `t3.micro` + 8 GB root volume        | 8.20       |
| 5 GB gp3 data volume                     | 0.50       |
| Public IPv4 (Elastic IP)                 | 3.65       |
| Secrets Manager (one secret)             | 0.40       |
| S3 (site and backups) + CloudFront + ECR | ~0.30      |
| **Total**                                | **~13**    |

That is half the corrected RDS figure. At this rate, $100 of credit outlasts the six-month credit period itself.

## Consequences

### Positive

- **The run rate halves**, from about $26 to about $13 a month, so the credits last longer than the period in which they can be spent.
- **The same database everywhere.** Development, the Testcontainers suites ([ADR-0020](0020-test-database-triggers-with-testcontainers.md)), the CI image smoke test and production all run the same `postgres:17-alpine` image, so the triggers, `citext` and the recursive queries ([ADR-0008](0008-defence-in-depth-cycle-prevention.md), [ADR-0011](0011-audit-trail-via-database-triggers.md)) are tested against exactly what runs live.
- **Tighter isolation.** RDS in a private subnet was reachable from anything in the VPC with the right security group. The container is reachable only from the API's Compose network.
- **Simpler infrastructure.** No RDS instance, subnet group or database security group, and no private subnet tier (see [ADR-0017](0017-omit-nat-gateway-use-ssm.md)). The Terraform `database/` module of [ADR-0018](0018-terraform-for-infrastructure.md) becomes a data volume and a backup bucket.

### Negative

- **Up to 24 hours of writes can be lost.** RDS offered point-in-time recovery to within about five minutes. Nightly dumps mean a failed data volume loses everything since the last dump. A manual run of `backup.sh` before any risky change narrows the gap when it matters.
- **Recovery is manual.** Restoring means running `pg_restore` from S3 by hand, where RDS would restore with one operation.
- **The instance is a single point of failure for both tiers.** That was already true of the API ([ADR-0015](0015-ec2-docker-for-api-compute.md)); it now covers the data too.
- **Maintenance is ours.** Minor PostgreSQL upgrades are an image tag change. A major upgrade needs a dump and restore, which RDS would have managed.
- **Backups sit in the same account and region** as the database, so they do not protect against losing the account or the region.
- **Memory is shared.** The API, PostgreSQL and Caddy share 1 GB, with swap as the safety margin. Heavy load would show up as latency before anything else.
- **The brief can be read more strictly.** An assessor may take "remote database" to mean a managed database service. This record exists so the choice reads as deliberate, with its trade-offs stated.

## Alternatives considered

- **Keep RDS ([ADR-0006](0006-postgresql-via-prisma.md)).** The most durable option, with managed backups and point-in-time recovery. Rejected: about $15 a month more, more than half the bill, against an explicit cheapest-possible goal.
- **RDS, stopped when idle.** RDS restarts a stopped instance automatically after seven days, and an assessor may open the URL at any time without warning. Rejected.
- **Aurora Serverless v2, scaling to zero.** Costs nothing while paused, but resumes in roughly 15 seconds on the first request after a pause and adds Aurora's storage and I/O charges. Rejected: a slow first page is a poor first impression, and the saving is uncertain.
- **A free external PostgreSQL host** (Neon, Supabase). Free indefinitely, but rejected for the same reason as in [ADR-0021](0021-credit-funded-run-rate-and-teardown.md): the project owner chose an all-AWS stack.
- **PostgreSQL installed on the host operating system.** No Docker overhead, but its version would follow the OS packages rather than match development and CI exactly. Rejected.
- **SQLite on the EBS volume.** No server process at all, but it has no `citext` and no PL/pgSQL triggers, so the cycle and audit guarantees of [ADR-0008](0008-defence-in-depth-cycle-prevention.md) and [ADR-0011](0011-audit-trail-via-database-triggers.md) would need rewriting. Rejected.
