# ADR-0033: Keep the API docs off the public deployment

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** Jaitin
- **Related:** [ADR-0004](0004-nestjs-for-the-api.md) (amended), [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md), [ADR-0025](0025-rate-limit-by-client-address.md)

## Context

[ADR-0004](0004-nestjs-for-the-api.md) serves Swagger UI at `/api/docs` and the OpenAPI document at `/api/docs-json`, unconditionally. On the live deployment both were open to anyone with the URL, without signing in.

The routes they describe are protected, but the map itself is useful to an attacker: every route, which ones are admin-only, every request and response shape, and the error codes to expect. It saves the reconnaissance a hand-rolled authentication layer ([ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)) would otherwise impose. The people who need the docs are developers, who run the API locally, and assessors, who can read the code.

## Decision

Serve the docs only when the `API_DOCS` setting allows it:

| Environment           | Default | Override         |
| --------------------- | ------- | ---------------- |
| Development and tests | On      | `API_DOCS=false` |
| Production            | Off     | `API_DOCS=true`  |

When off, `/api/docs` and `/api/docs-json` are never registered and answer 404 like any unknown route. The decorators stay in the code, so the docs are still complete wherever they are switched on.

## Consequences

### Positive

- The public deployment no longer publishes a map of its own API.
- Nothing changes for local development: `pnpm dev` still serves the docs at `http://localhost:3000/api/docs`.
- Switching them back on for a demonstration is one environment variable, with no code change.

### Negative

- Assessors cannot browse the live API's docs. They can run the API locally, or read the controllers and the shared schemas, which define the same shapes.
- An unrecognised `API_DOCS` value stops the API at startup, like every other invalid setting.

## Alternatives considered

- **Protect the docs with a login.** Swagger UI loads before any token is supplied, so it would need its own HTTP basic auth or an admin-only guard on both routes. More moving parts for a page production does not need.
- **Block `/api/docs*` at CloudFront.** Works, but splits one rule between the application and the infrastructure, and the docs would quietly return if the CloudFront behaviours changed.
- **Publish a static copy of the OpenAPI document in the repository.** Useful for readers, but it goes stale unless CI regenerates it. Left as a follow-up if assessors need it.
