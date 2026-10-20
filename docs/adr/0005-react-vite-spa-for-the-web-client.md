# ADR-0005: React + Vite SPA for the web client

- **Status:** Accepted; SPA deep-link routing by a CloudFront Function per [ADR-0027](0027-spa-routing-with-a-cloudfront-function.md)
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0002](0002-separate-api-and-web-deployables.md), [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md)

## Context

The brief requires two substantial UI surfaces:

1. **A visual representation of the organisation's hierarchy** (tree or graph), searchable, with edit and delete from within it.
2. **A reporting table** sortable and filterable on _any_ employee field.

React was selected as the frontend framework by the project owner. With the API separated out ([ADR-0002](0002-separate-api-and-web-deployables.md)) and the entire application behind a login, server-side rendering has nothing to contribute: there is no SEO surface and no anonymous first paint to optimise.

## Decision

Build a **React + Vite + TypeScript single-page application**, compiled to static assets and served from S3 behind CloudFront ([ADR-0016](0016-single-cloudfront-distribution-dual-origin.md)).

Supporting libraries, each chosen against a specific requirement in the brief:

| Library                            | Requirement it serves                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| **React Flow** + `d3-hierarchy`    | Visual hierarchy: viewport/pan/zoom from React Flow, `tree()` layout from d3                    |
| **TanStack Table**                 | Reporting table: per-column sort and filter, pagination, column visibility                      |
| **TanStack Query**                 | Server-state caching and invalidation after mutations                                           |
| **react-hook-form** + zod resolver | Forms bound to the shared schemas ([ADR-0003](0003-typescript-monorepo-with-shared-schemas.md)) |
| **Tailwind** + shadcn/ui           | Presentable UI without hand-rolling components                                                  |

The org chart supports collapse/expand, search-to-centre, and drag-a-node-onto-another to re-parent, with server-side cycle rejection surfaced inline.

## Consequences

### Positive

- No server process for the UI at all: static assets on a CDN, which is both the cheapest and the most scalable tier of the system.
- Vite's dev server keeps iteration fast on the chart, which is the most visually iterative part of the build.
- React Flow handles the hard parts of an interactive graph (viewport transforms, edge routing, hit testing) that would otherwise consume disproportionate effort in raw SVG.

### Negative

- Initial paint waits on the JS bundle — acceptable behind a login wall, as noted in [ADR-0002](0002-separate-api-and-web-deployables.md).
- SPA routing on S3 requires a CloudFront error-response rule mapping 403/404 to `/index.html`, which is easy to forget and fails only on hard refresh of a deep link.
- React Flow plus d3 adds meaningful bundle weight; the chart route is lazy-loaded to contain it.

## Alternatives considered

- **Next.js static export.** Keeps the originally proposed framework while still shipping static assets. Rejected in favour of plain React at the project owner's direction; it would also carry framework surface (routing conventions, server components) that goes unused.
- **Hand-rolled SVG org chart.** Full control and zero dependency weight. Rejected: pan, zoom, hit testing and edge routing are a large amount of undifferentiated work, and the time is better spent on the hierarchy invariants.
- **A ready-made org-chart component library.** Faster to a picture, but typically rigid about node rendering and interaction, which would block drag-to-re-parent.
