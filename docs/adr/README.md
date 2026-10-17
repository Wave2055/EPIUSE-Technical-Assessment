# Architecture Decision Records

Decision log for the EPI-USE technical assessment — a cloud-hosted employee hierarchy management system. See [`../Technical Services - Assessment v2.1.pdf`](../Technical%20Services%20-%20Assessment%20v2.1.pdf) for the brief.

Each record captures one decision with its context, consequences and the alternatives rejected. Records are immutable once Accepted; to reverse one, write a new record that supersedes it ([ADR-0001](0001-record-architecture-decisions.md)).

## Index

| #                                                          | Decision                                                                  | Status   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- | -------- |
| **Process**                                                |                                                                           |          |
| [0001](0001-record-architecture-decisions.md)              | Record architecture decisions in ADRs                                     | Accepted |
| **Application architecture**                               |                                                                           |          |
| [0002](0002-separate-api-and-web-deployables.md)           | Deploy the API and web client as separate processes                       | Accepted |
| [0003](0003-typescript-monorepo-with-shared-schemas.md)    | TypeScript monorepo with a shared validation package                      | Accepted |
| [0004](0004-nestjs-for-the-api.md)                         | NestJS as the API framework                                               | Accepted |
| [0005](0005-react-vite-spa-for-the-web-client.md)          | React + Vite SPA for the web client                                       | Accepted |
| **Data and domain**                                        |                                                                           |          |
| [0006](0006-postgresql-via-prisma.md)                      | PostgreSQL via Prisma as the system of record                             | Accepted |
| [0007](0007-adjacency-list-for-the-hierarchy.md)           | Model the reporting hierarchy as an adjacency list                        | Accepted |
| [0008](0008-defence-in-depth-cycle-prevention.md)          | **Prevent reporting cycles at both the service and database layers**      | Accepted |
| [0009](0009-permit-multiple-hierarchy-roots.md)            | Permit multiple hierarchy roots, surfaced as a warning                    | Accepted |
| [0010](0010-explicit-deletion-strategies.md)               | Require an explicit strategy when deleting a manager                      | Accepted |
| [0011](0011-audit-trail-via-database-triggers.md)          | Record the audit trail with database triggers and a session variable      | Accepted |
| **Employee profile and access**                            |                                                                           |          |
| [0012](0012-require-email-on-employee-record.md)           | **Add a required email field to the employee record**                     | Accepted |
| [0013](0013-avatar-resolution-chain.md)                    | Resolve avatars server-side through a fallback chain                      | Accepted |
| [0014](0014-self-hosted-jwt-auth-and-salary-masking.md)    | Self-hosted JWT authentication with role-based salary masking             | Accepted |
| **Infrastructure**                                         |                                                                           |          |
| [0015](0015-ec2-docker-for-api-compute.md)                 | Run the API container on an EC2 t3.micro                                  | Accepted |
| [0016](0016-single-cloudfront-distribution-dual-origin.md) | Serve the SPA and the API from one CloudFront distribution                | Accepted |
| [0017](0017-omit-nat-gateway-use-ssm.md)                   | Omit the NAT gateway; place EC2 in a public subnet and administer via SSM | Accepted |
| [0018](0018-terraform-for-infrastructure.md)               | Define all infrastructure in Terraform                                    | Accepted |
| **Delivery**                                               |                                                                           |          |
| [0019](0019-github-actions-oidc-cicd.md)                   | Deploy from GitHub Actions using OIDC role assumption                     | Accepted |
| [0020](0020-test-database-triggers-with-testcontainers.md) | Test against real PostgreSQL via Testcontainers                           | Accepted |
| [0021](0021-credit-funded-run-rate-and-teardown.md)        | Accept a credit-funded run rate and commit to teardown                    | Accepted |
| **Additional features**                                    |                                                                           |          |
| [0022](0022-home-screen-tasks-and-user-employee-link.md)   | Add a personal home screen with tasks, linking logins to employees        | Accepted |

## Start here

Three records carry most of the engineering judgement in this solution:

- **[ADR-0008 — Cycle prevention](0008-defence-in-depth-cycle-prevention.md).** The brief says employees "may not be their own manager". Self-management is only the degenerate case of a cycle; `A→B→C→A` is equally invalid and a SQL `CHECK` constraint cannot detect it. This is the central correctness problem of the assessment, and it is solved at two layers.
- **[ADR-0012 — Required email](0012-require-email-on-employee-record.md).** The brief's minimum field list contains no email, yet mandates Gravatar, which is addressed solely by a hash of an email. The two requirements are in tension; this records the resolution and why it is a deliberate deviation rather than an oversight.
- **[ADR-0015 — EC2 compute](0015-ec2-docker-for-api-compute.md).** The most compromised decision in the stack. The free-tier constraint beat the independent-scaling requirement, and the trade is recorded rather than disguised.

## Requirement traceability

| Brief requirement                                               | Where addressed                                                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRUD on employee data                                           | [0004](0004-nestjs-for-the-api.md), [0006](0006-postgresql-via-prisma.md), [0010](0010-explicit-deletion-strategies.md)                              |
| Reporting line manager; not own manager; manager-less employees | [0007](0007-adjacency-list-for-the-hierarchy.md), [0008](0008-defence-in-depth-cycle-prevention.md), [0009](0009-permit-multiple-hierarchy-roots.md) |
| Visual hierarchy (tree/graph)                                   | [0005](0005-react-vite-spa-for-the-web-client.md), [0007](0007-adjacency-list-for-the-hierarchy.md)                                                  |
| Search the hierarchy to find, edit, delete                      | [0005](0005-react-vite-spa-for-the-web-client.md), [0010](0010-explicit-deletion-strategies.md)                                                      |
| Reporting table, sortable and filterable on any field           | [0005](0005-react-vite-spa-for-the-web-client.md), [0006](0006-postgresql-via-prisma.md), [0014](0014-self-hosted-jwt-auth-and-salary-masking.md)    |
| Gravatar integration                                            | [0012](0012-require-email-on-employee-record.md), [0013](0013-avatar-resolution-chain.md)                                                            |
| Avatar upload _(optional nice-to-have)_                         | [0013](0013-avatar-resolution-chain.md)                                                                                                              |
| Cloud deployment at a provided URL                              | [0015](0015-ec2-docker-for-api-compute.md), [0016](0016-single-cloudfront-distribution-dual-origin.md), [0017](0017-omit-nat-gateway-use-ssm.md)     |
| No mocked data; remote database                                 | [0006](0006-postgresql-via-prisma.md), [0021](0021-credit-funded-run-rate-and-teardown.md)                                                           |
| Technical document                                              | this stack, summarised in `../technical-document.md`                                                                                                 |

## Design patterns

The brief requires the technical document to name the design patterns used. Each is applied to a specific problem rather than for its own sake:

| Pattern                  | Applied to                                         | Record                                                                                      |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Strategy                 | `promote` vs `reassign` on manager deletion        | [0010](0010-explicit-deletion-strategies.md)                                                |
| Chain of Responsibility  | Avatar fallback: upload → Gravatar → initials      | [0013](0013-avatar-resolution-chain.md)                                                     |
| Observer                 | Audit trail via database triggers                  | [0011](0011-audit-trail-via-database-triggers.md)                                           |
| Composite                | Org tree node structure                            | [0007](0007-adjacency-list-for-the-hierarchy.md)                                            |
| Repository + Data Mapper | Prisma-backed persistence layer                    | [0006](0006-postgresql-via-prisma.md)                                                       |
| Dependency Injection     | NestJS IoC container                               | [0004](0004-nestjs-for-the-api.md)                                                          |
| Decorator                | Guards, interceptors, `@Roles()`, `@CurrentUser()` | [0004](0004-nestjs-for-the-api.md), [0014](0014-self-hosted-jwt-auth-and-salary-masking.md) |
| Layered architecture     | Controller → Service → Repository                  | [0004](0004-nestjs-for-the-api.md)                                                          |

## Known compromises

Recorded here so they are found rather than discovered:

- **The API runs on a single instance in a single AZ** — no autoscaling, no failover ([0015](0015-ec2-docker-for-api-compute.md)).
- **CloudFront-to-origin traffic is unencrypted HTTP** inside AWS's network ([0016](0016-single-cloudfront-distribution-dual-origin.md)).
- **The application tier sits in a public subnet**, trading the conventional private-subnet layer for the cost of a NAT gateway ([0017](0017-omit-nat-gateway-use-ssm.md)).
- **Authentication is hand-rolled**, with no MFA, password reset or lockout ([0014](0014-self-hosted-jwt-auth-and-salary-masking.md)).
- **Deletion is hard, not soft** — the audit trail mitigates but does not replace recovery ([0010](0010-explicit-deletion-strategies.md)).
- **The deployment is credit-funded and must be torn down** ([0021](0021-credit-funded-run-rate-and-teardown.md)).

## Template

```markdown
# ADR-NNNN: Title in the imperative

- **Status:** Proposed | Accepted | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD
- **Deciders:** names
- **Related:** links to related records

## Context

The forces at play, the constraint, and why a decision is needed.

## Decision

What was decided, stated actively.

## Consequences

### Positive

### Negative

What this costs, stated honestly.

## Alternatives considered

What else was weighed, and why it lost.
```
