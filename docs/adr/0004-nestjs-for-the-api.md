# ADR-0004: NestJS as the API framework

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0003](0003-typescript-monorepo-with-shared-schemas.md), [ADR-0006](0006-postgresql-via-prisma.md), [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)

## Context

With the API split out as its own TypeScript deployable ([ADR-0002](0002-separate-api-and-web-deployables.md)), it needs a framework. The brief asks the technical document to name the **design patterns used**, so a framework whose structure is itself pattern-driven carries part of that deliverable.

The API is not CRUD-trivial. It carries hierarchy invariants ([ADR-0008](0008-defence-in-depth-cycle-prevention.md)), pluggable deletion behaviour ([ADR-0010](0010-explicit-deletion-strategies.md)), role-based field masking ([ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)) and an audit context that must be attached to every transaction ([ADR-0011](0011-audit-trail-via-database-triggers.md)). These are cross-cutting concerns, and the ease of expressing them cleanly is the real selection criterion.

## Decision

Use **NestJS** with a layered Controller → Service → Repository structure.

The cross-cutting concerns map onto first-class framework constructs:

| Concern                | Mechanism                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Auth and RBAC          | Guards (`@Roles()`, `@CurrentUser()` decorators)                                                   |
| Salary masking by role | Response interceptor                                                                               |
| Audit user attribution | Request-scoped provider feeding the transaction wrapper                                            |
| Validation             | Pipe bound to the shared zod schemas ([ADR-0003](0003-typescript-monorepo-with-shared-schemas.md)) |
| Error shaping          | Exception filter                                                                                   |

`@nestjs/swagger` generates OpenAPI documentation at `/api/docs` from the existing decorators.

## Consequences

### Positive

- Built-in dependency injection makes the hierarchy and deletion logic unit-testable in isolation, by injecting fakes rather than patching modules.
- Named, conventional seams for each cross-cutting concern — these are the Decorator, Chain of Responsibility and Strategy patterns in practice, which directly supplies the technical document's design-patterns section.
- Swagger documentation is close to free and gives assessors a browsable API surface.
- The module/provider structure is recognisably enterprise Java-like, which reads well for an SAP consultancy.

### Negative

- Heavier than Express or Fastify: more boilerplate and a steeper learning curve for a small API.
- Decorator-and-metadata-driven DI can produce opaque errors (circular dependencies, missing provider registration).
- Requires `reflect-metadata` and `experimentalDecorators`, constraining the build toolchain.

## Alternatives considered

- **Express or Fastify with hand-rolled structure.** Lighter and faster to start. Rejected: every cross-cutting concern becomes bespoke middleware, and the design-patterns deliverable has to be argued rather than demonstrated.
- **tRPC.** Excellent end-to-end type safety in a TypeScript monorepo. Rejected: it couples client and server tightly, which undercuts the independent-API goal of [ADR-0002](0002-separate-api-and-web-deployables.md), and produces no conventional REST surface for an assessor to inspect.
