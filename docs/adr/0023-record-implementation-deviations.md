# ADR-0023: Record where the implementation departs from earlier records

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Jaitin
- **Related:** amends [ADR-0004](0004-nestjs-for-the-api.md), [ADR-0005](0005-react-vite-spa-for-the-web-client.md), [ADR-0008](0008-defence-in-depth-cycle-prevention.md), [ADR-0011](0011-audit-trail-via-database-triggers.md), [ADR-0013](0013-avatar-resolution-chain.md), [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md), [ADR-0017](0017-omit-nat-gateway-use-ssm.md); see also [ADR-0019](0019-github-actions-oidc-cicd.md), [ADR-0020](0020-test-database-triggers-with-testcontainers.md)

## Context

Records 0002–0021 were written before the code. Building the API and connecting the web client changed some details. Some changes were forced by how a library behaves, some were simplifications, and some are work not yet done.

ADR-0001 forbids editing an accepted record. This record collects the differences in one place, and each affected record's status points here. None of them reverses the decision it amends.

## Decision

### Changes made deliberately

| Record   | Said                                                                       | Built                                                                                                                                                                                                  | Why                                                                                                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0013** | Presigned S3 **`PUT`**, with type and a 2 MB cap in the presign conditions | Presigned S3 **`POST`** with a `content-length-range` and `Content-Type` condition                                                                                                                     | A presigned `PUT` cannot enforce a size range. Only a POST policy lets S3 itself reject an oversized or wrong-type file, which is what ADR-0013 actually requires.                                                                         |
| **0013** | Objects stored as `avatars/{employeeId}/{uuid}.webp`                       | `avatars/{employeeId}/{uuid}.{png,jpg,webp}`, matching the uploaded type                                                                                                                               | Nothing converts images to WebP. Naming a PNG `.webp` would mislead every consumer.                                                                                                                                                        |
| **0017** | The API has no outbound dependency; S3 is browser-only                     | The API calls S3 for `HeadObject` (confirm an upload landed) and `DeleteObject` (clean up a replaced avatar)                                                                                           | Confirming the object exists stops a client pointing an employee at a key that was never uploaded. Both calls can use the free S3 gateway endpoint, so the NAT-free design still holds.                                                    |
| **0004** | Audit attribution through a request-scoped provider                        | The caller's user id is passed explicitly to `PrismaService.auditedTransaction(userId, fn)`                                                                                                            | A request-scoped provider makes everything that depends on it request-scoped too, which is slower and harder to test. The explicit argument is visible at every write, and the wrapper still sets the variable, so it cannot be forgotten. |
| **0011** | `SET LOCAL app.current_user_id = $1`                                       | `SELECT set_config('app.current_user_id', $1, true)`                                                                                                                                                   | `SET` cannot take a bind parameter. `set_config(..., true)` has identical transaction-local semantics and is safely parameterised.                                                                                                         |
| **0008** | `HierarchyService.assertNoCycle`                                           | `HierarchyService.assertValidManager`, which also rejects a manager that does not exist (`422 UNKNOWN_MANAGER`). The trigger raises SQLSTATE `HC001`, which the error filter maps to `HIERARCHY_CYCLE` | One call answers both questions before the write. A custom SQLSTATE makes the trigger's refusal recognisable without matching message text.                                                                                                |
| **0014** | Authentication "implemented within the API" (mechanism unspecified)        | A small global guard over `@nestjs/jwt`; no Passport. Configuration is a zod-validated `AppConfig` class; no `@nestjs/config`                                                                          | One strategy (Bearer HS256) does not need Passport's plugin model. Validating every variable at boot fails fast with all problems listed.                                                                                                  |
| **0005** | TanStack Table per-column sort and filter                                  | Sorting, search, filters and paging run in the API. The table only renders the header state                                                                                                            | The API needs the sort allowlist anyway, to refuse salary ordering for a viewer (ADR-0014). Doing it once on the server keeps the rule in one place and scales past one page of employees.                                                 |

### Not yet built

These parts of the earlier records are still to do. They are listed so they are found rather than discovered:

- **ADR-0005:** org chart collapse/expand and drag-a-node-to-re-parent. Re-parenting is done in the edit form today. Column visibility in the table.
- **ADR-0013:** the avatar upload screen. The API side exists; Gravatar and initials work.
- **ADR-0014:** the breached-password check. There is no screen for setting a password yet; logins come from the seed script.
- **ADR-0015–0019:** the Terraform infrastructure and the deploy-on-merge workflow. CI runs on every push and pull request.
- **ADR-0020:** the end-to-end Playwright test, which is still skipped.
- **CSV import**, which the API has a dependency for but no endpoint.

## Consequences

### Positive

- The ADR stack stays accurate without rewriting history: each amended record's status points here.
- The avatar size limit is enforced by S3, as ADR-0013 intended.
- The technical document can describe the system as built and link here for the differences.

### Negative

- Readers have to follow a link to see the current state of an amended record.
- The API gains a small outbound dependency on S3, though it can stay on the AWS network.
- The "not yet built" list is a commitment that has to be kept current or removed.

## Alternatives considered

- **Edit the original records in place.** Simpler to read, but it breaks ADR-0001 and hides that the design changed during implementation.
- **One superseding record per change.** Accurate, but eight small records for details that do not change any decision would bury the important ones.
