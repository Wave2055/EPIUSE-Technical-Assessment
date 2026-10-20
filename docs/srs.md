# Software requirements specification

**System:** Employee Hierarchy · **Version:** 1.0, as built on `dev` · **Date:** 2026-10-20 · **Author:** Jaitin

Structured after IEEE 830. Every requirement has an ID, its source, and how it is verified. Sources: **B** is the [assessment brief](Technical%20Services%20-%20Assessment%20v2.1.pdf); **X** is an extension beyond the brief, which the brief invites. Stories (US-nn) are in [user-stories.md](user-stories.md); decisions (ADR-nnnn) in [adr/](adr/README.md).

## 1. Introduction

### 1.1 Purpose

This document states what Employee Hierarchy must do and how well, so the system can be built, assessed and tested against it. It is written for the assessors and for anyone maintaining the system.

### 1.2 Scope

A cloud-hosted web application for EPI-USE Africa to manage employee records and the reporting structure between them: create, read, update and delete employees; set each employee's reporting-line manager without ever forming a loop; see the organisation as a chart and a table; search, sort and filter; and show each employee's Gravatar picture. All data is stored in a remote PostgreSQL database.

Out of scope: payroll, leave, performance management, single sign-on, and self-service account creation.

### 1.3 Definitions

| Term                   | Meaning                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Employee               | A person in the organisation, with a record in `employees`. Not necessarily a user. |
| User / login           | An account that can sign in. Optionally linked to one employee.                     |
| Admin                  | A user with role `ADMIN`: full access.                                              |
| Viewer                 | A user with role `VIEWER`: read-only, salaries hidden.                              |
| Manager                | The employee another employee reports to (their reporting-line manager).            |
| Direct report          | An employee whose manager is a given employee.                                      |
| Root                   | An employee with no manager.                                                        |
| Reporting loop / cycle | A chain of managers that leads back to where it started, including self-management. |
| Subtree                | An employee's direct reports, their reports, and so on.                             |

### 1.4 References

[Brief](Technical%20Services%20-%20Assessment%20v2.1.pdf) · [Technical document](technical-document.md) · [User guide](user-guide.md) · [Diagrams](diagrams.md) · [ADRs](adr/README.md) · [User stories](user-stories.md) · [Brand and style guide](brand-and-style-guide.md)

## 2. Overall description

### 2.1 Product perspective

A new, self-contained system: a React single-page app and a NestJS API in front of PostgreSQL, deployed on AWS behind one CloudFront distribution. The only external service it depends on at runtime is Gravatar, for pictures. See the [system context](diagrams.md#1-system-context) and [deployment](diagrams.md#2-deployment-on-aws) diagrams.

### 2.2 User classes

| Class               | Role              | Needs                                                                |
| ------------------- | ----------------- | -------------------------------------------------------------------- |
| HR administrator    | Admin             | Maintain records and reporting lines; review the audit trail         |
| Employee or manager | Viewer (or Admin) | Find colleagues, understand the structure, manage own and team tasks |
| Assessor            | Either            | Evaluate the system at a URL with no set-up                          |

### 2.3 Operating environment

- Current desktop browsers (Chrome, Edge, Firefox, Safari) with JavaScript enabled.
- Server: AWS eu-west-1, Linux, Docker; PostgreSQL 17; Node.js 22.

### 2.4 Constraints

| ID  | Constraint                                                                                       | Source                                                         |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| C-1 | Deployed to a cloud platform and reachable at a URL                                              | B                                                              |
| C-2 | No data mocked with hard-coded values or local files; all changes committed to a remote database | B                                                              |
| C-3 | Source in a git repository, shared with the assessors                                            | B                                                              |
| C-4 | Gravatar integration for profile pictures                                                        | B                                                              |
| C-5 | Run within the AWS account's credits, about $13 a month                                          | X, [ADR-0021](adr/0021-credit-funded-run-rate-and-teardown.md) |
| C-6 | No secrets in the repository                                                                     | X, [ADR-0018](adr/0018-terraform-for-infrastructure.md)        |

### 2.5 Assumptions

- The organisation has thousands of employees, not tens of thousands ([ADR-0031](adr/0031-load-the-whole-organisation-into-the-client.md)).
- Logins are created by administrators (currently by seed or database), not by self-registration.
- Employees who want a picture have, or will create, a Gravatar account with their work email.

## 3. Functional requirements

Priority: **M** must (the brief), **S** should (extension). Verification: **U** unit test, **I** integration test against real PostgreSQL, **E** end-to-end browser test on the Docker build, **R** review.

### 3.1 Employee records

| ID   | Requirement                                                                                                                                      | Pri | Source                                                      | Verified |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ----------------------------------------------------------- | -------- |
| FR-1 | An admin can create an employee with first name, surname, birth date, employee number, salary, role/position, reporting-line manager, and email. | M   | B, [ADR-0012](adr/0012-require-email-on-employee-record.md) | I, E     |
| FR-2 | Any signed-in user can read every employee's record.                                                                                             | M   | B                                                           | I, E     |
| FR-3 | An admin can update any field of an employee's record.                                                                                           | M   | B                                                           | I, E     |
| FR-4 | An admin can delete an employee.                                                                                                                 | M   | B                                                           | I, E     |
| FR-5 | Employee numbers follow `E-` and four digits and are unique.                                                                                     | S   | X                                                           | U, I, E  |
| FR-6 | Emails are valid, unique regardless of letter case, and stored lower-case.                                                                       | S   | X                                                           | U, I     |
| FR-7 | Birth dates are after 1900-01-01 and before today; salaries are from 0 to 1,000,000,000; names are 1–100 characters and roles 1–120.             | S   | X                                                           | U, I, E  |
| FR-8 | Invalid input is refused with each problem named against its field, and nothing is saved.                                                        | S   | X                                                           | I, E     |

### 3.2 Reporting structure

| ID    | Requirement                                                                                                                                                                                                                                                                   | Pri | Source                                                       | Verified |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------ | -------- |
| FR-10 | An admin can set or change an employee's reporting-line manager.                                                                                                                                                                                                              | M   | B                                                            | I, E     |
| FR-11 | An employee may have no manager.                                                                                                                                                                                                                                              | M   | B                                                            | I, E     |
| FR-12 | An employee may not be their own manager, directly or through any chain; such a change is refused with the chain of names.                                                                                                                                                    | M   | B, [ADR-0008](adr/0008-defence-in-depth-cycle-prevention.md) | U, I, E  |
| FR-13 | FR-12 holds for writes that bypass the API.                                                                                                                                                                                                                                   | M   | [ADR-0008](adr/0008-defence-in-depth-cycle-prevention.md)    | I        |
| FR-14 | The manager picker never offers the employee or anyone in their subtree.                                                                                                                                                                                                      | S   | X                                                            | U, E     |
| FR-15 | A manager that does not exist is refused.                                                                                                                                                                                                                                     | S   | X                                                            | I        |
| FR-16 | Deleting a manager requires a choice for their direct reports: move them to the deleted person's manager (default), or to a nominated employee outside the deleted person's subtree. A root's team must be reassigned. The move and the delete happen together or not at all. | S   | X, [ADR-0010](adr/0010-explicit-deletion-strategies.md)      | U, I, E  |
| FR-17 | More than one root is allowed and shown as a warning.                                                                                                                                                                                                                         | S   | [ADR-0009](adr/0009-permit-multiple-hierarchy-roots.md)      | U, E     |

### 3.3 Viewing and finding

| ID    | Requirement                                                                                                                                   | Pri | Source | Verified |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------ | -------- |
| FR-20 | The organisation is shown as an interactive tree that can be panned and zoomed, with each person's picture, name, role and number of reports. | M   | B      | U, E     |
| FR-21 | Users can search the hierarchy by name, role or employee number and open the person found.                                                    | M   | B      | E        |
| FR-22 | From a search result, admins can edit or delete the person.                                                                                   | M   | B      | E        |
| FR-23 | A table lists every employee, sortable on every field.                                                                                        | M   | B      | U, E     |
| FR-24 | The table filters on every field: free text across name, number, email and role; role; manager; birth-date range; salary range.               | M   | B      | U, E     |
| FR-25 | Search text is matched literally; `%`, `_` and quotes have no special meaning.                                                                | S   | X      | U, I     |

### 3.4 Pictures

| ID    | Requirement                                                                                                                                                                    | Pri | Source                                             | Verified |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | -------------------------------------------------- | -------- |
| FR-30 | Each employee's Gravatar picture is shown, looked up by the SHA-256 of their trimmed, lower-cased email.                                                                       | M   | B, [ADR-0013](adr/0013-avatar-resolution-chain.md) | U, E     |
| FR-31 | Without a Gravatar, the employee's initials are shown.                                                                                                                         | S   | X                                                  | R        |
| FR-32 | An admin can upload a PNG, JPEG or WebP picture up to 2 MB for an employee through the API, which then takes priority over Gravatar. _(The web app has no upload screen yet.)_ | S   | B (optional)                                       | I        |

### 3.5 Access and accountability

| ID    | Requirement                                                                                                                                                                         | Pri | Source                                                             | Verified |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------ | -------- |
| FR-40 | Every page and data route requires sign-in, except sign-in itself and the health check.                                                                                             | S   | X, [ADR-0014](adr/0014-self-hosted-jwt-auth-and-salary-masking.md) | I, E     |
| FR-41 | Sessions survive a reload and renew without re-entering a password for up to 7 days of inactivity; signing out ends the session.                                                    | S   | X, [ADR-0030](adr/0030-web-session-renewal.md)                     | U, I, E  |
| FR-42 | Only admins can create, update or delete employees or view the audit trail.                                                                                                         | S   | X                                                                  | I, E     |
| FR-43 | Viewers never receive salaries, and cannot sort or filter by salary.                                                                                                                | S   | X                                                                  | U, I, E  |
| FR-44 | Every create, update, re-parent and delete of an employee is recorded with time, user (or system) and each field's before and after values, including changes made outside the API. | S   | X, [ADR-0011](adr/0011-audit-trail-via-database-triggers.md)       | I, E     |
| FR-45 | Admins can view the audit trail newest first, filter it by kind of change, and page through it.                                                                                     | S   | X                                                                  | I, E     |

### 3.6 Home and tasks

| ID    | Requirement                                                                                                                         | Pri | Source                                                              | Verified |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------- | -------- |
| FR-50 | A user linked to an employee sees their profile, manager, direct reports and task counts.                                           | S   | X, [ADR-0022](adr/0022-home-screen-tasks-and-user-employee-link.md) | I, E     |
| FR-51 | A user can add, update, complete and delete their own tasks, each with an optional due date.                                        | S   | X                                                                   | I, E     |
| FR-52 | A user sees their direct reports' tasks, read-only.                                                                                 | S   | X                                                                   | I, E     |
| FR-53 | A manager can add a task to a direct report's list, marked as from them, and change or delete it while that person reports to them. | S   | X, [ADR-0032](adr/0032-managers-assign-tasks-to-direct-reports.md)  | U, I, E  |

## 4. External interface requirements

### 4.1 User interface

A responsive single-page app following the [brand and style guide](brand-and-style-guide.md): a dark header with Home, Org chart, Employees and Audit trail; dialogs for forms and confirmations; toasts for results. Described page by page in the [user guide](user-guide.md).

### 4.2 Software interface: the API

JSON over HTTPS under `/api`, on the same origin as the web app. Errors are always `{ code, message, details? }`. Interactive documentation is served at `/api/docs` outside production ([ADR-0033](adr/0033-keep-api-docs-off-the-public-deployment.md)).

| Method and path                                   | Who               | Purpose                                                      |
| ------------------------------------------------- | ----------------- | ------------------------------------------------------------ |
| `POST /api/auth/login`                            | anyone            | Sign in; returns an access token and sets the refresh cookie |
| `POST /api/auth/refresh`                          | cookie            | Rotate the refresh cookie; returns a new access token        |
| `POST /api/auth/logout`                           | anyone            | End the session                                              |
| `GET /api/health`                                 | anyone            | Liveness, including the database                             |
| `GET /api/employees`                              | signed in         | List with search, sort, filters and paging                   |
| `GET /api/employees/:id`                          | signed in         | One employee                                                 |
| `POST /api/employees`                             | admin             | Create                                                       |
| `PATCH /api/employees/:id`                        | admin             | Update, including the manager                                |
| `DELETE /api/employees/:id?strategy=&reassignTo=` | admin             | Delete, moving the team by strategy                          |
| `POST /api/employees/:id/avatar/upload-url`       | admin             | Presigned upload to S3                                       |
| `PATCH /api/employees/:id/avatar`                 | admin             | Attach an uploaded picture                                   |
| `DELETE /api/employees/:id/avatar`                | admin             | Remove it, back to Gravatar                                  |
| `GET /api/hierarchy`                              | signed in         | Every employee as a chart node                               |
| `GET /api/audit?action=&employeeId=`              | admin             | Audit trail, paged                                           |
| `GET /api/me`                                     | signed in         | The user, their employee, manager and reports                |
| `GET /api/me/tasks?scope=mine\|team`              | linked user       | Own tasks, or own and direct reports'                        |
| `POST /api/me/tasks`                              | linked user       | Add a task (optionally for a direct report)                  |
| `PATCH /api/me/tasks/:id`                         | owner or assigner | Update a task                                                |
| `DELETE /api/me/tasks/:id`                        | owner or assigner | Delete a task                                                |

### 4.3 External services

| Service  | Use                                     | If unavailable                                                     |
| -------- | --------------------------------------- | ------------------------------------------------------------------ |
| Gravatar | Profile pictures, loaded by the browser | Initials are shown                                                 |
| AWS S3   | Uploaded pictures                       | Uploads answer `503 AVATAR_UPLOADS_DISABLED`; Gravatar still works |

## 5. Non-functional requirements

| ID                               | Requirement                                                                                                                                                                               | Verified                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Security**                     |                                                                                                                                                                                           |                                                                     |
| NFR-1                            | Passwords are stored only as argon2id hashes; refresh tokens only as SHA-256 hashes.                                                                                                      | R, U                                                                |
| NFR-2                            | A wrong password and an unknown email get the same answer.                                                                                                                                | U, E                                                                |
| NFR-3                            | Sign-in is limited to 10 attempts per 15 minutes per client address, then blocked for 15 minutes; every other route to 300 requests a minute.                                             | I, E                                                                |
| NFR-4                            | Forged, expired, unsigned or tampered tokens are refused. A replayed refresh token revokes its whole session family.                                                                      | U, I                                                                |
| NFR-5                            | The API accepts requests only through CloudFront: by security group, and by a secret header required in production.                                                                       | I, R                                                                |
| NFR-6                            | The web app sends a Content-Security-Policy allowing scripts only from its own origin, with no inline script or eval, and forbidding framing; plus HSTS, `nosniff` and a referrer policy. | E                                                                   |
| NFR-7                            | No source maps, dotfiles or API documentation are served publicly.                                                                                                                        | E                                                                   |
| NFR-8                            | No secret is stored in the repository or CI settings; deployment uses short-lived OIDC credentials.                                                                                       | R, CI secret scan                                                   |
| **Reliability and data**         |                                                                                                                                                                                           |                                                                     |
| NFR-10                           | Every change to employees is made in a transaction; multi-step changes (deleting a manager) are atomic.                                                                                   | I                                                                   |
| NFR-11                           | The database is backed up to S3 nightly; its volume survives replacement of the server.                                                                                                   | R                                                                   |
| NFR-12                           | Malformed or oversized requests are answered 4xx in the standard error shape, never 500.                                                                                                  | I                                                                   |
| **Performance**                  |                                                                                                                                                                                           |                                                                     |
| NFR-20                           | Once the organisation is loaded, sorting, filtering and chart search respond without a server round trip.                                                                                 | R                                                                   |
| NFR-21                           | The web app is served from CloudFront's edge, including South Africa.                                                                                                                     | R                                                                   |
| **Usability and accessibility**  |                                                                                                                                                                                           |                                                                     |
| NFR-30                           | Controls are reachable by keyboard and labelled for assistive technology (Radix primitives, labelled inputs).                                                                             | E (tests select by accessible name)                                 |
| NFR-31                           | Text and controls meet WCAG AA contrast against their backgrounds.                                                                                                                        | R, [brand guide](brand-and-style-guide.md)                          |
| **Maintainability and delivery** |                                                                                                                                                                                           |                                                                     |
| NFR-40                           | Request and response shapes are defined once and shared by the API and the web app.                                                                                                       | R, typecheck                                                        |
| NFR-41                           | Every push and pull request runs secret scanning, formatting, lint, typecheck, unit, integration and end-to-end tests, and both builds.                                                   | CI                                                                  |
| NFR-42                           | Merging to `main` deploys automatically; schema migrations apply as the new version starts.                                                                                               | CI/CD                                                               |
| NFR-43                           | All infrastructure is defined in Terraform and can be removed with one command.                                                                                                           | R                                                                   |
| **Cost**                         |                                                                                                                                                                                           |                                                                     |
| NFR-50                           | The deployment runs for about $13 a month, within the account's credits, with budget alerts.                                                                                              | R, [ADR-0023](adr/0023-postgresql-container-on-the-api-instance.md) |

## 6. Traceability to the brief

| Brief requirement                                                        | Requirements                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Create, read, update and delete employee data                            | FR-1–FR-4                                                                      |
| Set an employee's reporting-line manager                                 | FR-10                                                                          |
| Employees may not be their own manager                                   | FR-12, FR-13                                                                   |
| An employee may have no manager                                          | FR-11                                                                          |
| Minimum fields: name, surname, birth date, number, salary, role, manager | FR-1                                                                           |
| Visual representation of the hierarchy                                   | FR-20                                                                          |
| Search the hierarchy to find, edit or delete                             | FR-21, FR-22                                                                   |
| Table sortable and filterable on any field                               | FR-23, FR-24                                                                   |
| Gravatar integration                                                     | FR-30                                                                          |
| Upload _(optional)_                                                      | FR-32                                                                          |
| Cloud deployment at a URL                                                | C-1                                                                            |
| No mocked data; remote database                                          | C-2                                                                            |
| Git repository                                                           | C-3                                                                            |
| User guide; technical document                                           | [user-guide.md](user-guide.md), [technical-document.md](technical-document.md) |

## 7. Known gaps

- **FR-32:** picture upload exists in the API only; there is no upload screen.
- **No account management screen:** logins are created and linked to employees by seed or in the database.
- **No password reset, MFA or per-account lockout** ([ADR-0014](adr/0014-self-hosted-jwt-auth-and-salary-masking.md)).
- **Tasks are not audited**, and there is no edit or delete control for tasks in the web app; only the done tick.
