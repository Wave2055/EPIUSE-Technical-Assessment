# ADR-0010: Require an explicit strategy when deleting a manager

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0007](0007-adjacency-list-for-the-hierarchy.md), [ADR-0009](0009-permit-multiple-hierarchy-roots.md), [ADR-0011](0011-audit-trail-via-database-triggers.md)

## Context

The brief requires the ability to delete employee data, but says nothing about what happens to an employee's **direct reports** when their manager is deleted. This is unspecified and consequential: deleting a mid-level manager of a 40-person department affects 40 records, not one.

The database-level options are all unacceptable on their own:

- `ON DELETE CASCADE` — silently deletes the entire subtree. A mis-click removes a department.
- `ON DELETE SET NULL` — silently promotes every direct report to a root, scattering the hierarchy ([ADR-0009](0009-permit-multiple-hierarchy-roots.md)).
- `ON DELETE RESTRICT` — safe, but makes any manager permanently undeletable.

None is right as a default, because the correct answer depends on _why_ the employee is being removed.

## Decision

Set `ON DELETE RESTRICT` on the foreign key so the database refuses to orphan or cascade, and handle re-parenting explicitly in the service layer. `DELETE /employees/:id` takes a required strategy, implemented as the **Strategy pattern**:

| Strategy              | Behaviour                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `promote` _(default)_ | Direct reports are re-parented to the deleted employee's own manager — the grandparent. Models the common case of a departure, where a team moves up a level. |
| `reassign`            | Direct reports move to a nominated `reassignTo` employee. Models a hand-over.                                                                                 |

Rules:

- Deleting a **root** that has reports **requires** `reassign`; `promote` would create one new root per direct report.
- `reassignTo` is validated against the cycle rules of [ADR-0008](0008-defence-in-depth-cycle-prevention.md) — a subordinate cannot be chosen as the new manager of their own former subtree.
- The whole operation runs in **one transaction**, so a partial re-parent is impossible.
- Each re-parent writes its own `REPARENT` audit row ([ADR-0011](0011-audit-trail-via-database-triggers.md)), so the fate of every affected employee is recoverable.

The UI requires the choice explicitly, showing the number of affected reports and a preview of their destination before confirming.

## Consequences

### Positive

- No destructive outcome is ever implicit. The user chooses, with the blast radius shown first.
- The strategies are small, independently unit-testable objects — a clean, genuine instance of the Strategy pattern for the technical document.
- Re-parenting is auditable, so a mistaken deletion can be reconstructed.
- Adding a future strategy (`cascade` for correcting a bad import, say) is an additive change.

### Negative

- Deletion is a multi-step interaction rather than one click.
- The API contract is non-obvious: `DELETE` takes query parameters and can return 422, which is unusual enough to warrant explicit documentation in Swagger.
- Deleting a large subtree touches many rows in one transaction, briefly holding locks. Immaterial at this scale.

## Alternatives considered

- **`ON DELETE CASCADE`.** One line, no service code. Rejected as unacceptably destructive for a hierarchy that exists to be edited.
- **`ON DELETE SET NULL`.** Non-destructive and simple. Rejected: it silently produces exactly the multi-root condition [ADR-0009](0009-permit-multiple-hierarchy-roots.md) treats as a data-quality fault.
- **Block deletion of any employee with reports.** Safest and trivially explainable; the user re-parents manually first. Rejected as poor UX for the common case — a departing manager whose team simply moves up a level.
- **Soft delete (`deleted_at`).** Fully reversible and the better answer for real HR data with retention obligations. Rejected as scope: it complicates every query, the uniqueness constraint on employee number, and the hierarchy traversal, for a benefit the audit trail already largely provides. **The first thing to add for production use.**
