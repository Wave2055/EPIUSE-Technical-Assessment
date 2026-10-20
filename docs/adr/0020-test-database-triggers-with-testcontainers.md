# ADR-0020: Test against real PostgreSQL via Testcontainers

- **Status:** Accepted; the E2E layer extended to a full Docker build and every user-facing rule per [ADR-0035](0035-end-to-end-tests-on-a-full-docker-build.md)
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0008](0008-defence-in-depth-cycle-prevention.md), [ADR-0010](0010-explicit-deletion-strategies.md), [ADR-0011](0011-audit-trail-via-database-triggers.md)

## Context

The two most important correctness guarantees in this system are **enforced by the database, not by application code**:

- Cycle prevention lives in a PL/pgSQL trigger ([ADR-0008](0008-defence-in-depth-cycle-prevention.md)).
- The audit trail lives in triggers reading a session variable ([ADR-0011](0011-audit-trail-via-database-triggers.md)).

A test suite that mocks the database or runs against SQLite **cannot exercise either of them**. It would pass with the triggers entirely absent — testing the thing that matters least while asserting confidence in the thing that matters most. Mocked Prisma tests would additionally not catch a recursive CTE that is simply wrong.

Since the whole point of [ADR-0008](0008-defence-in-depth-cycle-prevention.md) is that the database holds the line when application code is bypassed, the test suite must be able to bypass the application code too.

## Decision

Run integration tests against a **real PostgreSQL instance in a Docker container, managed by Testcontainers**, with migrations applied exactly as in production.

Three layers, by what each is good at:

| Layer           | Target                                                                                  | Tool                          |
| --------------- | --------------------------------------------------------------------------------------- | ----------------------------- |
| **Unit**        | Cycle traversal logic, deletion strategies, Gravatar hashing, the sort/filter allowlist | Vitest, dependencies injected |
| **Integration** | Triggers, constraints, recursive CTEs, transaction behaviour, the full HTTP surface     | Supertest + Testcontainers    |
| **E2E**         | One happy path: login → create → re-parent → search → delete → verify audit             | Playwright                    |

The integration suite includes tests that **write directly via raw SQL, bypassing the API entirely**, and assert the database rejects them:

- insert a self-managing row
- create `A→B`, then set `A` as `B`'s manager (2-cycle)
- create `A→B→C`, then set `C` as `A`'s manager (deep cycle)
- re-parent a node into its own subtree
- update a row with no session variable set, and assert the audit row exists with `changed_by IS NULL`

Both enforcement layers are asserted to reject the same inputs, which is what keeps the duplicated logic of [ADR-0008](0008-defence-in-depth-cycle-prevention.md) honest.

## Consequences

### Positive

- The guarantees that actually matter are verified against the engine that enforces them, including the PL/pgSQL and the CTEs.
- Each test gets a clean, migrated database, so tests are isolated and order-independent.
- Migrations are exercised on every CI run, so a broken one fails in CI rather than on deploy ([ADR-0019](0019-github-actions-oidc-cicd.md)).
- Catches the class of bug where the service check and the trigger disagree — invisible to any mocked suite.

### Negative

- Integration tests are substantially slower than unit tests (container startup is seconds, not milliseconds), so the suites are kept separate and only unit tests run on watch.
- Requires a working Docker daemon on every developer machine and in CI.
- A container per suite consumes real memory, which matters on constrained CI runners.

## Alternatives considered

- **Mocked Prisma client.** Fast, no Docker. Rejected: tests nothing the database does, which here is nearly everything that could go wrong.
- **SQLite as the test database.** Fast and in-process. Rejected: no PL/pgSQL, no `citext`, no `jsonb`, different recursive CTE semantics. The test database would not be the production database, so a passing suite would mean very little.
- **A shared long-lived test database.** No per-test startup cost. Rejected: cross-test pollution and no safe parallelism; truncating between tests is fragile with triggers and sequences in play.
