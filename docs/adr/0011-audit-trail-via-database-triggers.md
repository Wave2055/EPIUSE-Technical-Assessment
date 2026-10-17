# ADR-0011: Record the audit trail with database triggers and a session variable

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0006](0006-postgresql-via-prisma.md), [ADR-0010](0010-explicit-deletion-strategies.md), [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)

## Context

Employee records carry salary and reporting-line data. Changes to either are consequential, and "who moved this person under that manager, and when?" is a question an HR system must be able to answer. An audit trail is not in the brief's minimum requirements, but it was selected as in-scope.

The difficulty is **completeness versus attribution**, which pull in opposite directions:

- Audit written in **application code** knows the acting user, but is bypassed by CSV import, seed scripts, migrations and direct `psql` access — exactly the paths most likely to cause unexplained changes.
- Audit written by a **database trigger** catches every writer, but the database has no idea which application user is behind a connection from a shared pool.

## Decision

Write the audit trail with `AFTER INSERT OR UPDATE OR DELETE` triggers, and solve attribution with a **transaction-scoped PostgreSQL session variable**.

```sql
CREATE TABLE employee_audit (
  id          bigserial PRIMARY KEY,
  employee_id uuid NOT NULL,
  action      text NOT NULL,          -- CREATE | UPDATE | DELETE | REPARENT
  changed_by  uuid,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  before      jsonb,
  after       jsonb
);
```

The API issues `SET LOCAL app.current_user_id = $1` as the first statement of every write transaction. The trigger reads it with `current_setting('app.current_user_id', true)` — the `true` making it return `NULL` rather than error when unset, so a seed script or manual `psql` write is still audited, just attributed to nobody.

`SET LOCAL` is scoped to the transaction, so a pooled connection cannot leak one user's identity into another's request.

Critically, this is implemented **once** in a `PrismaService.auditedTransaction()` wrapper. No caller can forget it, because no caller sets it.

## Consequences

### Positive

- The trail is complete by construction. Nothing that modifies an employee row can avoid being recorded, including bulk import and migrations.
- `before`/`after` as `jsonb` captures whole-row state without a schema change per audited column.
- Re-parenting during a strategy-driven delete ([ADR-0010](0010-explicit-deletion-strategies.md)) is captured per affected employee, making the operation reconstructable.
- Keeps audit concerns entirely out of the service layer — the Observer pattern, realised in the database.

### Negative

- Audit logic lives in migration SQL, away from the application code it records; a developer changing the schema may not realise a trigger is watching.
- The session-variable mechanism is non-obvious and fails _silently_ if the transaction wrapper is bypassed — the write succeeds, merely unattributed. This is a deliberate trade (completeness over attribution) but must be documented and tested.
- `jsonb` snapshots of every row duplicate storage; the audit table will outgrow `employees`. Needs a retention policy before production.
- A `before`/`after` snapshot includes the salary, so the audit table inherits the sensitivity of the data it records and must be access-controlled accordingly ([ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)).

## Alternatives considered

- **Prisma middleware / client extension.** Lives with the application code, fully typed, easy to test. Rejected: invisible to every writer that is not the Prisma client, which defeats the purpose.
- **Explicit audit writes in each service method.** Maximum control and clarity at each call site. Rejected: relies on every author remembering, and silently degrades as the codebase grows.
- **Event sourcing.** The audit trail becomes the system of record. Rejected as far beyond the scope of this assessment, and a poor fit for the relational queries the reporting table needs.
- **PostgreSQL logical decoding / CDC into a separate store.** The production-grade answer at scale. Rejected: disproportionate infrastructure for a single `t3.micro` deployment.
