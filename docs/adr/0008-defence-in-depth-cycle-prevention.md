# ADR-0008: Prevent reporting cycles at both the service and database layers

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0007](0007-adjacency-list-for-the-hierarchy.md), [ADR-0011](0011-audit-trail-via-database-triggers.md), [ADR-0020](0020-test-database-triggers-with-testcontainers.md)

## Context

The brief states: _"It should be noted that employees may not be their own manager."_

Taken literally that is one constraint, satisfied by `CHECK (manager_id <> id)`. But self-management is only the **degenerate case of a cycle**. The same reasoning forbids `A→B→A` and `A→B→C→A`: in each the reporting chain never reaches a root, so there is no CEO, the structure is not a tree, and any recursive traversal loops forever. A graph with a cycle is not a hierarchy.

A SQL `CHECK` constraint can only inspect the row being written, so it is structurally incapable of detecting a cycle of length greater than one. The adjacency list chosen in [ADR-0007](0007-adjacency-list-for-the-hierarchy.md) therefore leaves this invariant unenforced by default. **This is the central correctness problem of the assessment.**

There are two places the check could live, each with a distinct failing:

- **Service layer only** — bypassed by CSV import, seed scripts, migrations, or anyone with `psql`. The database would permit corrupt data.
- **Trigger only** — the invariant holds, but the user receives an opaque constraint violation rather than an explanation.

## Decision

Enforce the acyclicity invariant at **both** layers, with each layer owning a different responsibility.

**1. Database trigger — the guarantee.** A `BEFORE INSERT OR UPDATE OF manager_id` trigger walks the proposed manager's ancestor chain with a recursive CTE and raises an exception if the row being written appears in it. This is authoritative and applies to _every_ writer, including bulk import and direct SQL.

**2. Service layer — the explanation.** `HierarchyService.assertNoCycle` performs the same traversal before the write and rejects with HTTP 422 and a human-readable path:

```
Would create a cycle: Dlamini → Naidoo → Botha → Dlamini
```

The `CHECK (manager_id <> id)` constraint from [ADR-0007](0007-adjacency-list-for-the-hierarchy.md) is retained as a third, cheapest layer for the self-management case the brief names directly.

These are not redundant. The trigger is the correctness boundary; the service call exists for the error message. If they ever disagree, the trigger wins and the service has a bug.

## Consequences

### Positive

- The invariant is impossible to violate through any path into the database, which is the only standard that actually means anything.
- Users re-parenting a node in the org chart get an actionable message naming the offending chain, not a 500.
- The combination is a clear, demonstrable instance of defence in depth and is the strongest single item in the technical document.

### Negative

- The traversal logic exists twice, in PL/pgSQL and in TypeScript, and must be kept in agreement. Mitigated by integration tests that assert both reject the same inputs ([ADR-0020](0020-test-database-triggers-with-testcontainers.md)).
- The trigger adds a read to every `manager_id` write. Negligible at this depth.
- Trigger logic in migration SQL is less discoverable than application code.

## Alternatives considered

- **`CHECK (manager_id <> id)` alone.** Satisfies the brief's literal wording and nothing more. Rejected: leaves multi-node cycles fully representable, which is the actual risk.
- **Service-layer check alone.** The common implementation. Rejected: CSV import ([ADR-0012](0012-require-email-on-employee-record.md) notwithstanding) and seed scripts bypass it, and the database is left able to hold data that breaks every traversal in the system.
- **Detect cycles on read, with a depth cap.** Defensive and cheap. Retained _in addition_ — every recursive CTE uses `UNION` and a depth cap — but rejected as a primary defence: it tolerates corrupt data and merely survives it.
- **A closure table making cycles structurally impossible.** Genuinely eliminates the problem rather than policing it. Rejected for the write-cost reasons in [ADR-0007](0007-adjacency-list-for-the-hierarchy.md).
