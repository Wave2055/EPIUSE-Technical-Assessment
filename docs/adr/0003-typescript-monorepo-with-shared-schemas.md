# ADR-0003: TypeScript monorepo with a shared validation package

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0002](0002-separate-api-and-web-deployables.md), [ADR-0004](0004-nestjs-for-the-api.md), [ADR-0005](0005-react-vite-spa-for-the-web-client.md)

## Context

[ADR-0002](0002-separate-api-and-web-deployables.md) splits the system into two deployables. The classic failure mode of that split is **contract drift**: the client's idea of a valid employee record diverges from the server's, and the mismatch is discovered by a user rather than by the compiler.

Employee records carry non-trivial validation — a birth date that must be in the past and imply a plausible working age, a non-negative salary, a unique employee number format, a well-formed email. Writing those rules twice guarantees they will eventually disagree.

## Decision

Use a single pnpm-workspace monorepo:

```
apps/api         NestJS service
apps/web         React + Vite SPA
packages/shared  zod schemas + inferred TypeScript types
infra            Terraform
docs             deliverables, including this ADR stack
```

`packages/shared` holds the zod schemas as the **single source of validation truth**. The API consumes them through a NestJS `ZodValidationPipe` for DTO validation; the web client consumes the same objects through react-hook-form's zod resolver. Request and response TypeScript types are _inferred_ from those schemas (`z.infer`) rather than declared separately.

## Consequences

### Positive

- A validation rule is written once. Client and server cannot disagree about what a valid employee is.
- Changing a shared schema breaks compilation on both sides immediately, turning a runtime contract bug into a build-time error.
- One install, one lint configuration, one test command, one atomic commit per cross-cutting change.

### Negative

- Workspace tooling complexity: `packages/shared` must be built before its dependents, and deployment builds must not naively prune workspace dependencies.
- The API Docker image build context is the repository root rather than `apps/api`, which makes the Dockerfile slightly more involved.
- A monorepo weakly couples the independent-deployment story of ADR-0002 at _build_ time — though not at runtime, which is what the requirement concerns.

## Alternatives considered

- **Two separate repositories.** Maximum independence, but no mechanism to share validation, and a cross-cutting change becomes two PRs. Rejected.
- **Shared types published as a private npm package.** The correct answer for multiple teams on independent release cycles. For a single-author assessment it adds a publish step to every change for no benefit. Rejected.
- **OpenAPI-generated client types.** Generates types from the implemented API, so the server stays authoritative — but it propagates _types_ only, not the validation _rules_, so the client still needs its own form validation. Retained as a complement: Swagger is generated anyway (see [ADR-0004](0004-nestjs-for-the-api.md)).
