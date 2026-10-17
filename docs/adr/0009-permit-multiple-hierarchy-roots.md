# ADR-0009: Permit multiple hierarchy roots, surfaced as a warning

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0007](0007-adjacency-list-for-the-hierarchy.md), [ADR-0010](0010-explicit-deletion-strategies.md)

## Context

The brief says an employee _"may be in such a position whereby they have no manager (e.g., the CEO)"_. The singular example suggests one root, and a strict reading would enforce exactly one employee with `manager_id IS NULL`.

That constraint cannot be satisfied in practice:

- **Bootstrapping.** The very first employee created in an empty system necessarily has no manager. If one root is already required, the system can never reach a valid state from empty.
- **Import.** CSV import may legitimately load a subtree before its parent exists, or load several departments in sequence.
- **Deletion.** Deleting the root under the `promote` strategy ([ADR-0010](0010-explicit-deletion-strategies.md)) would promote all its direct reports to roots simultaneously.

A multi-root structure is still a valid forest: every traversal terminates, and no cycle exists. It is a _data-quality_ concern, not a _correctness_ one.

## Decision

Permit any number of roots. Do not constrain `manager_id IS NULL` to a single row.

Treat more than one root as a **data-quality warning rather than an error**: the dashboard surfaces a prominent banner when `count(*) WHERE manager_id IS NULL > 1`, listing the roots and linking to each so the condition can be resolved deliberately.

The org chart renders a forest, with each root as a separate top-level tree.

## Consequences

### Positive

- The system can be bootstrapped from empty and can accept partial imports, which a single-root rule makes impossible.
- Transient multi-root states during a re-organisation are tolerated instead of blocking the write that would resolve them.
- The condition stays visible rather than silently accumulating; the user is informed and in control.

### Negative

- The database permits an organisational structure that is arguably invalid, relying on the UI to flag it.
- Tree-rendering and traversal code must handle a forest, not a single root — every "get the tree" path takes an optional `rootId` and returns a list.
- A reviewer reading the brief strictly may read this as a missed constraint. Hence this record, and hence the visible warning.

## Alternatives considered

- **Enforce exactly one root** via a partial unique index (`CREATE UNIQUE INDEX ON employees ((manager_id IS NULL)) WHERE manager_id IS NULL`). Faithful to a strict reading. Rejected: unsatisfiable on an empty database, and it turns ordinary re-organisation into a constraint violation.
- **A synthetic "organisation" root row.** Guarantees a single tree and removes the nullable foreign key. Rejected: it injects a fake employee into employee data, which would appear in the reporting table, headcounts and salary aggregates, and contradicts the brief's framing of a manager-less employee.
- **Allow multiple roots silently.** Simplest. Rejected: an accidental orphan subtree is a real data-integrity problem and should not be invisible.
