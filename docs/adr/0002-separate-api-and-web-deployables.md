# ADR-0002: Deploy the API and web client as separate processes

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0004](0004-nestjs-for-the-api.md), [ADR-0005](0005-react-vite-spa-for-the-web-client.md), [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md)

## Context

The brief calls for "a cloud hosted application". The obvious lowest-effort reading is a single full-stack deployable — a Next.js application with API routes, deployed as one unit, which is what was initially proposed.

The stated requirement from the project owner is that **the API and the UI must be able to scale independently**. These two workloads have genuinely different profiles: the web client is static, cacheable content with effectively unbounded read concurrency, while the API is stateful request handling bounded by a database connection pool.

## Decision

Build and deploy two independent artifacts:

- `apps/api` — a containerised NestJS HTTP service
- `apps/web` — a static React SPA bundle

They share no runtime. They communicate only over HTTP via the public API contract, and share compile-time types only through `packages/shared` (see [ADR-0003](0003-typescript-monorepo-with-shared-schemas.md)).

## Consequences

### Positive

- Each tier scales on its own axis: the SPA is served from a CDN with no origin capacity concern, while API capacity is tuned independently.
- The API is reusable by a future mobile client or an SAP-side integration without refactoring.
- A clean, documented HTTP contract is forced into existence rather than being bypassed by in-process function calls.

### Negative

- Two build pipelines and two deployment targets instead of one.
- Cross-origin concerns are introduced — though these are neutralised by the dual-origin CDN in [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md).
- No server-side rendering, so the initial paint waits on the JS bundle. Acceptable for an authenticated internal tool with no SEO requirement.

## Alternatives considered

- **Next.js with API routes (single deployable).** Fastest route to a deployed URL and the initial proposal. Rejected: UI and API scale as one unit, which directly contradicts the requirement.
- **Next.js front end calling a separate API.** Retains Next.js as a React framework but adds a third running process (the Next server) whose SSR capability goes unused behind a login wall. Rejected as cost and complexity with no corresponding benefit.
