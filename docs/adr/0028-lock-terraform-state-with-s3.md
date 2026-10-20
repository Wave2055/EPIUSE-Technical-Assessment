# ADR-0028: Lock Terraform state with S3's native lock file

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Jaitin
- **Related:** amends the state backend of [ADR-0018](0018-terraform-for-infrastructure.md); [ADR-0021](0021-credit-funded-run-rate-and-teardown.md)

## Context

[ADR-0018](0018-terraform-for-infrastructure.md) kept state in S3 with a DynamoDB table for locking, the long-standing pattern. Since Terraform 1.10, the S3 backend can lock state itself with a lock file next to the state object (`use_lockfile = true`), and the DynamoDB option is deprecated.

Something still has to create the state bucket before any stack can use it.

## Decision

- Lock state with **S3's native lock file**. There is no DynamoDB table.
- A small **bootstrap stack** (`infra/bootstrap/`) creates the state bucket and keeps its own state locally, since it creates the bucket remote state would live in. The bucket is private, versioned and encrypted, and old state versions expire after 30 days.
- The same stack creates the **budget alerts** that [ADR-0021](0021-credit-funded-run-rate-and-teardown.md) requires before anything else, so they exist before any billable resource. `create_budgets = false` skips them for an account where they were made by hand.
- The main stack names its bucket at `terraform init` (`-backend-config="bucket=…"`), so no account ID is committed.

## Consequences

### Positive

- One fewer resource and service to create, secure and pay for.
- Budget alerts are part of the code and are created before anything that costs money.

### Negative

- Requires Terraform 1.10 or later.
- The bootstrap stack's state is a local file. It holds no secrets, but losing it means importing the bucket to manage it again, or deleting it by hand at teardown.

## Alternatives considered

- **DynamoDB locking, as originally planned.** Works, but is deprecated in the S3 backend and adds a resource for no benefit at this scale.
- **Local state for the main stack.** Simplest, but the state holds generated secrets ([ADR-0018](0018-terraform-for-infrastructure.md)) and must never sit where it could be committed.
