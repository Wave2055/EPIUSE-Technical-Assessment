# ADR-0036: Give every employee a login, managed by admins

- **Status:** Accepted
- **Date:** 2026-10-21
- **Deciders:** Jaitin
- **Related:** [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md) (amended), [ADR-0022](0022-home-screen-tasks-and-user-employee-link.md) (amended), [ADR-0011](0011-audit-trail-via-database-triggers.md), [ADR-0025](0025-rate-limit-by-client-address.md)

## Context

[ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md) kept logins separate from employees, since most employees would never sign in, and [ADR-0022](0022-home-screen-tasks-and-user-employee-link.md) let a login link to at most one employee. The result: only the two seeded logins existed, and the only way to add one was a manual database insert on the server.

The requirement is now that:

- every person created has credentials to sign in;
- an admin can create regular users;
- an admin can promote a user to admin.

There is to be no public sign-up: the system holds salaries and birth dates, and access is granted, not taken.

## Decision

**One person, one employee record, one login.** `users.employee_id` becomes required and unique, and deleting the employee deletes the login (`ON DELETE CASCADE`). "Add employee" creates both in one transaction. The login's email is the employee's email, and its role starts as regular user (`VIEWER`).

**The first password is generated, and shown once.**

- The API generates a one-time password: 16 characters from an alphabet without look-alikes (no `0/O`, `1/l/I`), about 92 bits, from the operating system's secure random source.
- It is returned in the create response and nowhere else. Only its argon2id hash is stored.
- The admin passes it on privately.
- `must_change_password` is set, so the person must choose their own (12–200 characters) before doing anything else.

**Existing employees get logins with no password.** The migration gives every employee without a login one whose password hash is NULL. Sign-in with it is refused, with the same answer as a wrong password, until an admin issues a one-time password from the Users page. The two seeded logins are unchanged. An employee whose email already belongs to a different login is skipped rather than failing the deploy; there is none in production.

**Admins manage access on a Users page** (`/api/users`, admin-only):

| Action                         | Effect                                                                    |
| ------------------------------ | ------------------------------------------------------------------------- |
| Make admin / Make regular user | Changes the role                                                          |
| Reset password                 | Issues a new one-time password, shown once; the old one stops working     |
| Deactivate / Reactivate        | Blocks or restores sign-in; the employee record and history are untouched |

Anyone can change their own password from the account menu, by giving the current one.

**Access changes take effect immediately.**

- The access token proves who the caller is. The guard now reads the login on every request (one primary-key lookup) and takes the role, deactivation and `must_change_password` from the database, not from the token.
- Promotion therefore works on the very next request.
- Demotion, deactivation, a password reset and a password change also revoke every refresh token the user holds.
- A user with a one-time password can only change it, read `/me`, or sign out. Everything else answers `403 PASSWORD_CHANGE_REQUIRED`.

**Admins cannot lock the system out.**

- An admin cannot change their own access or delete their own employee record (`CANNOT_CHANGE_SELF`), so the caller is always a second active admin.
- The only remaining risk is a race: two admins demoting each other at once. The last-admin check locks the active admins' rows (`SELECT … FOR UPDATE`) before counting, so the second transaction waits, recounts, and is refused (`LAST_ADMIN`).

**Every access change is audited.** A trigger on `users`, like the one on employees ([ADR-0011](0011-audit-trail-via-database-triggers.md)), writes to `user_audit`:

- created, role changed, deactivated, reactivated, password reset, password changed, deleted;
- each with who did it, read from the same transaction variable;
- never a password or hash;
- ordinary sign-ins record nothing.

The audit page shows these under **Account changes**.

## Consequences

### Positive

- Anyone can be given access in the normal course of adding them, with no server access needed.
- Revoking access is immediate, not "within 15 minutes".
- The admin never knows the password the person ends up using.
- Promotions and deactivations are accountable, like employee changes.

### Negative

- **One extra database read per request**, by primary key. Negligible at this scale; a cache would be the next step if it ever mattered.
- **Every employee has a login, wanted or not.** Unused ones have no password, so they cannot be signed into, but they appear on the Users page.
- **The one-time password travels through the admin**, out of band. There is no email delivery; there is no email service in the stack.
- **No self-service reset.** A forgotten password needs an admin. A reset link by email would need an email service.
- The JWT still carries the role for compatibility, but it is ignored. A forged role claim gets nothing, as a test confirms.

## Alternatives considered

- **Public sign-up, restricted to existing employees' emails.** Self-service, but anyone who knows a colleague's email could claim their account. Without email verification there is no proof of ownership.
- **Admin sets the password.** Simpler, but the admin then knows a password the person may reuse elsewhere.
- **Invitation links by email.** The usual answer. Rejected for now because it needs an email service (SES, with domain verification), which the deployment does not have.
- **Keep the role in the token and accept up to 15 minutes' delay.** No extra read, but a deactivated or demoted user keeps access for the rest of the token's life.
- **Separate "Add user" form.** Logins without employees would break the home page and tasks, which are built on the person's employee record ([ADR-0022](0022-home-screen-tasks-and-user-employee-link.md)).
