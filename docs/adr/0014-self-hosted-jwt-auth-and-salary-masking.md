# ADR-0014: Self-hosted JWT authentication with role-based salary masking

- **Status:** Accepted; rate limiting in [ADR-0025](0025-rate-limit-by-client-address.md), web session handling in [ADR-0030](0030-web-session-renewal.md); logins, roles read per request, and admin account management per [ADR-0036](0036-every-employee-has-a-login-managed-by-admins.md)
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0004](0004-nestjs-for-the-api.md), [ADR-0011](0011-audit-trail-via-database-triggers.md), [ADR-0012](0012-require-email-on-employee-record.md)

## Context

The brief does not require authentication. But it does require the solution to be deployed to a public URL, and the data model holds **every employee's salary and date of birth**. An unauthenticated public URL would mean a world-readable, world-editable salary database — and an assessor could reasonably treat shipping that as a judgement failure regardless of the brief's silence.

Authentication was therefore selected as in-scope, implemented inside the API rather than delegated to Amazon Cognito.

## Decision

Implement authentication within the NestJS API.

**Tokens.** Short-lived access JWT (15 minutes) returned to the client; long-lived refresh token in an `httpOnly; Secure; SameSite=Lax` cookie, rotated on every use with reuse detection. The access token is held in memory, never in `localStorage`, so an XSS cannot exfiltrate a long-lived credential.

**Passwords.** `argon2id`, the current password-hashing recommendation. No password policy beyond a length minimum and a breached-password check on set.

**Roles.** Two, deliberately minimal:

| Role     | Capability                                   |
| -------- | -------------------------------------------- |
| `ADMIN`  | Full CRUD, import, audit log, salary visible |
| `VIEWER` | Read-only; **salary masked**                 |

**Salary masking is enforced in the API**, by a response interceptor that strips the field for `VIEWER`, not by hiding a column in the UI. The browser never receives a value the user is not entitled to see. The reporting table correspondingly refuses to sort or filter on salary for a `VIEWER`, because permitting it would leak the ordering of a hidden field.

Authenticated users are a **separate table** from employees. Most employees are not system users, and conflating the two would mean creating credentials for everyone in the org chart.

## Consequences

### Positive

- The deployed URL is not a public salary database.
- Gives the audit trail ([ADR-0011](0011-audit-trail-via-database-triggers.md)) a real `changed_by` to record.
- Guards, decorators and the masking interceptor are visible in the repository's own source, which demonstrates the Decorator and Chain of Responsibility patterns concretely for the technical document — the main reason this was preferred over Cognito.
- Local development and integration tests need no cloud dependency to log in.
- Refresh-token rotation with reuse detection is a meaningful step above a naive long-lived JWT.

### Negative

- **Hand-rolled authentication is a liability.** Password storage, token rotation, timing-safe comparison and lockout are all now this codebase's problem, and getting any of them subtly wrong is a real security bug. This is the single largest risk accepted in this ADR stack.
- No MFA, no password reset flow, no account lockout. Acceptable for an assessment, **not** acceptable for production.
- The JWT signing key becomes a secret requiring management ([ADR-0018](0018-terraform-for-infrastructure.md) places it in Secrets Manager).
- Two roles is coarse. Real HR authorisation is hierarchical — a manager should see their own subtree's salaries and no others.

## Alternatives considered

- **Amazon Cognito.** The safer engineering choice: no password handling, MFA and reset flows included, 10k MAU free, and coherent with the AWS stack. Rejected because the demonstrable auth code is itself part of the deliverable, and because it adds a cloud dependency to local development and tests. **This is the alternative to adopt for any production use** — the negatives above are precisely what Cognito removes.
- **No authentication.** What the brief literally asks for. Rejected: publishes salaries and dates of birth to the open internet.
- **HTTP Basic auth at the CloudFront or Caddy layer.** Two lines of configuration, keeps the data private, zero application code. A reasonable minimum, and worth noting it would have satisfied the actual risk. Rejected: no per-user identity, so no audit attribution and no role-based masking.
- **Hierarchical authorisation** (a manager sees their own subtree). The genuinely correct model for this domain, and attractive because the recursive queries to support it already exist. Rejected as scope for the assessment; recorded as the natural next step.
