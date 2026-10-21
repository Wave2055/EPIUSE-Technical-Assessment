# ADR-0022: Add a personal home screen with tasks, linking logins to employees

- **Status:** Accepted; managers may assign tasks to direct reports per [ADR-0032](0032-managers-assign-tasks-to-direct-reports.md); every employee now has exactly one login per [ADR-0036](0036-every-employee-has-a-login-managed-by-admins.md)
- **Date:** 2026-10-17
- **Deciders:** Jaitin
- **Related:** [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md) (amended), [ADR-0007](0007-adjacency-list-for-the-hierarchy.md), [ADR-0010](0010-explicit-deletion-strategies.md)

## Context

The brief's surfaces are all organisation-wide: the org chart, the reporting table and search. None answers the question a person asks when they open the app: _where do I sit, who reports to me, and what are we working on?_ The brief invites additional functionality as long as it is documented.

A home screen built around the signed-in person needs two things the model does not have:

1. **A link from a login to an employee.** ADR-0014 deliberately keeps logins in a separate `users` table, because most employees are not system users. Nothing says which employee, if any, a login belongs to.
2. **Somewhere to keep work items.** Nothing in the employee record describes current work.

## Decision

**Link a login to at most one employee** with `users.employee_id`: nullable, unique, `ON DELETE SET NULL`.

- Nullable keeps ADR-0014's separation: an administrator account need not be an employee, and most employees still have no login.
- Unique means one person cannot be represented by two logins.
- `SET NULL` means deleting an employee never deletes or locks out the login. The home screen falls back to its unlinked state.

**Add a `tasks` table** owned by an employee (`ON DELETE CASCADE`), with a title, a status of `todo`, `in_progress` or `done`, and an optional due date. It is exposed under `/api/me`:

| Route                               | Rule                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- |
| `GET /me`                           | The login, its linked employee, their manager and direct reports      |
| `GET /me/tasks?scope=mine`          | The linked employee's own tasks                                       |
| `GET /me/tasks?scope=team`          | Own tasks, then each **direct** report's, grouped by person           |
| `POST`, `PATCH`, `DELETE /me/tasks` | Owner only. Another person's task id answers 404, so it does not leak |

A login with no linked employee gets `409 NOT_LINKED` from the task routes.

Visibility follows the reporting line one level down, matching what the home screen shows. Managers read their direct reports' tasks; they never edit them.

## Consequences

### Positive

- Gives the application a personal entry point without weakening the login/employee separation.
- The team view is a direct, everyday use of the reporting hierarchy the brief is about.
- Task writes are scoped to the caller's own employee id in the query, so ownership cannot be bypassed by guessing ids.

### Negative

- More schema and API surface beyond the brief, which must be maintained and documented.
- Tasks are not audited. The audit trail (ADR-0011) covers employee records only, which is where the brief's accountability concern lies.
- Linking a login to an employee is a seed-time or database operation for now. There is no admin screen for it.

## Alternatives considered

- **Match a login to an employee by email.** No schema change, but it breaks silently when either email changes, and the two tables have different uniqueness rules.
- **Give every employee a login.** Simpler joins, but it reverses ADR-0014 and means managing credentials for people who never use the system.
- **Let managers see their whole subtree's tasks.** More powerful, but noisy for senior managers and not what the home screen shows. It can be added later with the recursive query that already exists.
