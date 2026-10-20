# ADR-0032: Let managers assign tasks to their direct reports

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** Jaitin
- **Related:** [ADR-0022](0022-home-screen-tasks-and-user-employee-link.md) (amended), [ADR-0007](0007-adjacency-list-for-the-hierarchy.md), [ADR-0010](0010-explicit-deletion-strategies.md)

## Context

[ADR-0022](0022-home-screen-tasks-and-user-employee-link.md) gave each person a task list and let managers _read_ their direct reports' lists, never write to them. In practice, much of a person's work is handed to them by their manager, and a manager who can see the team's lists but not add to them has to go elsewhere to delegate.

Letting managers write to reports' lists raises three questions:

1. **Who may assign?** The reporting line already answers "who is my boss"; a separate permission would duplicate it.
2. **Who may change an assigned task afterwards?** Both the person doing the work and the person who handed it over have a claim.
3. **What happens when the reporting line changes?** People are re-parented by edits and by manager deletion ([ADR-0010](0010-explicit-deletion-strategies.md)).

## Decision

**A manager may add a task to the list of any of their direct reports.** `POST /api/me/tasks` takes an optional `employeeId`. Omitted, the task is the caller's own, as before. Otherwise it must be someone whose `manager_id` is the caller's linked employee, or the API answers `403 FORBIDDEN`. Only direct reports qualify, matching what the team view shows; a skip-level manager cannot assign.

**The task records who assigned it** in a new nullable `tasks.assigned_by` column referencing `employees`. It is `NULL` for a task the owner wrote, and `ON DELETE SET NULL`, so deleting the manager keeps the work on the report's list. The API returns it as `assignedBy` (id and name), and the UI shows "From _name_", or "From you" to the manager.

**Who can change a task:**

| Caller                                         | Own tasks | Tasks assigned to them | Tasks they assigned to a report |
| ---------------------------------------------- | --------- | ---------------------- | ------------------------------- |
| The owner                                      | Full      | Full                   | —                               |
| The assigning manager, while still the manager | —         | —                      | Edit and delete                 |
| Anyone else                                    | 404       | 404                    | 404                             |

The owner keeps full control of their own list, including tasks handed to them, because they are the one accountable for it. The manager's rights over a task last only while the person still reports to them: the check joins to the owner's current `manager_id` on every request, so re-parenting someone moves control to their new reporting line with no data migration.

The rule is enforced in the query that finds the task (`employee_id = me`, or `assigned_by = me` and the owner's `manager_id = me`), so a guessed task id cannot widen it.

## Consequences

### Positive

- Delegation happens where the team's work is already visible, using the reporting line the application exists to manage.
- No new permission model: the hierarchy is the permission.
- Re-parenting and manager deletion need no special handling for tasks.

### Negative

- A report can delete a task their manager gave them, and the manager is not told. A notification or an audit trail of tasks would address this; tasks are still not audited ([ADR-0022](0022-home-screen-tasks-and-user-employee-link.md)).
- After a re-parent, the old manager loses access to tasks they assigned and the new manager gains none over them, though the new manager can see them in the team view.
- Ticking a task done stays with the owner in the UI. The API would let the assigning manager change its status, but the team view shows reports' tasks read-only, to keep "done" meaning the person doing the work says so.

## Alternatives considered

- **Let managers edit every task on a report's list.** Simpler to state, but managers could rewrite tasks their reports set for themselves.
- **Let anyone up the reporting chain assign.** More powerful for senior managers, but it bypasses the direct manager and the team view does not show skip-level reports.
- **Only the assigner may change or delete an assigned task.** Protects the manager's intent, but leaves the person doing the work unable to correct or remove an item on their own list.
