# ADR-0031: Load the whole organisation into the web client

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Jaitin
- **Related:** [ADR-0005](0005-react-vite-spa-for-the-web-client.md), [ADR-0007](0007-adjacency-list-for-the-hierarchy.md), [ADR-0008](0008-defence-in-depth-cycle-prevention.md), [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)

## Context

The UI was first built against an in-browser mock seeded with design fixtures. The brief forbids mocked data, so the mock had to be replaced with the API before submission.

The API's `GET /api/employees` supports server-side search, sorting and filtering on every field, paged up to 500 rows at a time. But nearly every screen needs the **whole** organisation, not one page of it:

- The org chart lays out the complete tree ([ADR-0007](0007-adjacency-list-for-the-hierarchy.md)).
- Manager pickers must leave out the employee's own subtree, which needs every descendant, to keep reporting loops out of the choices ([ADR-0008](0008-defence-in-depth-cycle-prevention.md)).
- The delete dialog lists the direct reports who will move.
- The reporting table sorts and filters with TanStack Table ([ADR-0005](0005-react-vite-spa-for-the-web-client.md)).

## Decision

The web client loads **every employee once**, page by page at 500 rows until the total is reached, into one shared TanStack Query cache entry. The reporting table, org chart, pickers and dialogs all read from it. Sorting and filtering in the table happen in the browser.

Any change (create, edit, re-parent, delete) refreshes that list, along with the audit trail and the home screen. Salaries arrive already masked for a `VIEWER` ([ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)), and the table still refuses to sort or filter on salary for a viewer.

The audit trail, which grows without bound, is the exception: it is filtered on the server and loaded 50 entries at a time.

The old mock (`apps/web/src/mocks/`) is deleted, and the client's types are re-exported from `@epiuse/shared`, so the UI cannot drift from the API's shapes.

## Consequences

### Positive

- One request, one cache entry, and every screen agrees about the organisation.
- Sorting, filtering and chart search are instant after the first load.
- The cycle-safe manager picker works on complete data, not on a page of it.

### Negative

- **Scales with the organisation.** A few thousand employees is a few hundred KB, which is fine. Tens of thousands would need server-side paging in the table and a lazily expanding chart.
- The API's server-side sorting and filtering go unused by the UI for now, though they stay available.
- The first load of any employee screen waits for the whole list.

## Alternatives considered

- **Server-side paging, sorting and filtering in the table.** The scalable design, and the API already supports it. Rejected for now: the chart and pickers would still need the whole tree, giving two sources of truth for the same data at assessment scale.
- **A dedicated hierarchy endpoint for the chart (`GET /api/hierarchy`).** Lighter rows, but the details panel needs the full record, and the table needs the same data anyway.
- **Keeping the mock alongside the API, behind a flag.** Rejected: the brief forbids mocked data in the submitted solution, and a flag invites shipping the wrong mode.
