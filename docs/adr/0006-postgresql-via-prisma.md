# ADR-0006: PostgreSQL via Prisma as the system of record

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0007](0007-adjacency-list-for-the-hierarchy.md), [ADR-0008](0008-defence-in-depth-cycle-prevention.md), [ADR-0011](0011-audit-trail-via-database-triggers.md), [ADR-0015](0015-ec2-docker-for-api-compute.md)

## Context

The brief is unambiguous: _"No data may be mocked using hardcoded values or local files, as all modifications must be committed to a remote database."_ A managed remote database is therefore mandatory, not a preference.

The dominant data access pattern is **recursive**: walk ancestors to validate a re-parent, walk descendants to render a subtree, compute depth for layout. The secondary pattern is **arbitrary filtering and sorting across every field**, as the reporting table requires.

## Decision

Use **PostgreSQL** as the system of record, accessed through **Prisma** as the ORM and migration tool, hosted on **Amazon RDS** (`db.t4g.micro`).

Prisma is used for the ordinary CRUD, filtering and sorting surface. Recursive hierarchy queries are written as **raw SQL recursive CTEs** via `$queryRaw`, because Prisma has no relational-recursion construct. Schema objects that Prisma cannot express — triggers, functions, `CHECK` constraints, the `citext` extension — are managed as hand-written SQL inside Prisma migration files, which remain the single ordered migration history.

## Consequences

### Positive

- `WITH RECURSIVE` makes ancestor and descendant traversal a single round trip, which is what makes [ADR-0007](0007-adjacency-list-for-the-hierarchy.md) viable.
- Triggers give database-level enforcement of the hierarchy and audit invariants, so correctness does not depend on every writer going through the API ([ADR-0008](0008-defence-in-depth-cycle-prevention.md), [ADR-0011](0011-audit-trail-via-database-triggers.md)).
- Prisma's generated types flow into the shared type story of [ADR-0003](0003-typescript-monorepo-with-shared-schemas.md), and its migration history is reviewable in git.
- RDS provides automated backups and point-in-time recovery without operational effort.

### Negative

- Raw SQL for the recursive queries falls outside Prisma's type generation, so result shapes are asserted manually and must be kept in step by hand.
- Trigger logic lives in migration SQL rather than application code, making it less discoverable — mitigated by exercising it directly in tests ([ADR-0020](0020-test-database-triggers-with-testcontainers.md)).
- RDS is the single largest line item in the cost model ([ADR-0021](0021-credit-funded-run-rate-and-teardown.md)).
- `db.t4g.micro` caps connections at roughly 81, which constrains the compute topology — a constraint that ruled out serverless compute in [ADR-0015](0015-ec2-docker-for-api-compute.md).

## Alternatives considered

- **Firebase / Firestore.** Named in the brief as an acceptable host and has a genuinely free tier. Rejected: a document store has no recursive query primitive, so hierarchy traversal becomes N round trips or a denormalised path field maintained by hand. The strongest technical argument in this solution would be lost.
- **MySQL on RDS.** Supports recursive CTEs since 8.0. Rejected: weaker `jsonb` support for audit payloads, no `citext`, and no partial indexes.
- **TypeORM or Drizzle.** TypeORM has first-class tree entities (including closure tables), but its migration ergonomics and maintenance record are weaker; Drizzle is leaner but its migration tooling was less mature at selection time.
- **Raw SQL with a query builder, no ORM.** Maximum control over the recursive queries. Rejected: hand-writing the entire CRUD, filter and sort surface is a poor use of the time budget.
