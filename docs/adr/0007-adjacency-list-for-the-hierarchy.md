# ADR-0007: Model the reporting hierarchy as an adjacency list

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0006](0006-postgresql-via-prisma.md), [ADR-0008](0008-defence-in-depth-cycle-prevention.md), [ADR-0009](0009-permit-multiple-hierarchy-roots.md)

## Context

The brief requires control of "the employees reporting structure by setting an employee's reporting line manager", with the reporting line manager as a field on the employee record. The hierarchy must be rendered as a tree, searched, and re-parented freely.

Expected scale for an organisation of this kind is in the low thousands of employees with a depth under about fifteen levels. Writes (hiring, re-organisation) are far rarer than reads.

## Decision

Model the hierarchy as a classic **adjacency list**: a nullable self-referencing `manager_id` foreign key on `employees`.

```sql
manager_id uuid REFERENCES employees(id) ON DELETE RESTRICT,
CONSTRAINT not_own_manager CHECK (manager_id IS NULL OR manager_id <> id)
```

`manager_id IS NULL` denotes a root — the CEO case the brief calls out explicitly. Traversal is handled by recursive CTEs, with `UNION` rather than `UNION ALL` and an explicit depth cap so that even corrupt data cannot produce an unbounded query.

`ON DELETE RESTRICT` is deliberate: deletion of a manager is an explicit, strategy-driven operation ([ADR-0010](0010-explicit-deletion-strategies.md)), never a silent cascade or orphaning.

## Consequences

### Positive

- Exactly matches the brief's own framing — the reporting line manager _is_ a field on the employee record.
- Re-parenting is a single-row `UPDATE`. In a closure table it would be a bulk delete-and-insert across the moved subtree.
- No derived structure to keep consistent, so no class of bug where the hierarchy and its index disagree.
- The foreign key makes referential integrity free: a `manager_id` cannot point at a non-existent employee.

### Negative

- **Cycles are not preventable by constraint.** The `CHECK` stops self-management but cannot see other rows, so `A→B→C→A` is representable. This is the central trade-off and is addressed in full by [ADR-0008](0008-defence-in-depth-cycle-prevention.md).
- Every ancestor or descendant query requires recursion; there is no single-join path to "all reports, transitively".
- Depth-dependent query cost. Irrelevant at the expected scale, material at hundreds of thousands of rows.

## Alternatives considered

- **Closure table** (a row per ancestor-descendant pair). Makes subtree queries a simple indexed join and can enforce acyclicity structurally. Rejected: re-parenting a subtree becomes an O(ancestors × descendants) rewrite, writes need trigger maintenance of a second table, and the storage and complexity cost is not justified at this scale. **This is the alternative to revisit first if the dataset grows by orders of magnitude.**
- **Materialised path** (`/ceo/cto/eng-lead/`). Cheap prefix queries via `LIKE` or `ltree`. Rejected: re-parenting rewrites every descendant's path, and the path duplicates information the foreign key already holds, creating a consistency burden.
- **Nested sets** (left/right bounds). Very fast reads. Rejected: almost any write renumbers a large portion of the table — the worst possible fit for a structure that exists to be re-organised.
