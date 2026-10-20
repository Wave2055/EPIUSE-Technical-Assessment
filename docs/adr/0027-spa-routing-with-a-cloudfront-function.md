# ADR-0027: Route the SPA with a CloudFront Function

- **Status:** Accepted; response headers and dot-path 404s per [ADR-0034](0034-harden-the-public-web-surface.md)
- **Date:** 2026-10-19
- **Deciders:** Jaitin
- **Related:** supersedes the SPA-routing rule of [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md) and the related note in [ADR-0005](0005-react-vite-spa-for-the-web-client.md)

## Context

The SPA's routes, such as `/employees` or `/hierarchy`, exist only in the browser. S3 has no object at those paths, so a hard refresh or a shared link to one returns an S3 error unless something serves `index.html` in its place.

[ADR-0016](0016-single-cloudfront-distribution-dual-origin.md) planned the usual fix: CloudFront custom error responses that rewrite 403 and 404 to `/index.html`. Custom error responses apply to the **whole distribution**, not to one behaviour. Every 403 or 404 from `/api/*` would also be replaced with the SPA's HTML and a 200. The API's own responses would be lost, among them `NOT_FOUND`, `FORBIDDEN`, and the 403 returned when a request bypasses the origin secret. The client would then try to parse HTML as JSON.

## Decision

Attach a **CloudFront Function** (`cloudfront-js-2.0`) to the viewer-request event of the **default (S3) behaviour only**. If the last path segment has no file extension, it is an app route, and the function rewrites the URI to `/index.html`. Paths with an extension are real assets and pass through untouched.

The `/api/*` and `/avatars/*` behaviours have no function and no error rewriting, so their status codes reach the client unchanged. The function's source is `infra/modules/cdn/spa-routing.js`.

## Consequences

### Positive

- Deep links and hard refreshes work on every app route.
- API errors keep their status and JSON body, which the web client relies on to show the API's message.
- A missing asset still returns a real error instead of an HTML page served as JavaScript.

### Negative

- A route whose last segment contains a dot (for example `/employees/j.smith`) would be treated as an asset. No current route has one, and IDs are UUIDs, but it is a rule to keep in mind.
- One more piece of code at the edge. Functions are free within 2 million invocations a month and add well under a millisecond.

## Alternatives considered

- **Custom error responses (the original plan).** Simplest to configure, but corrupts API errors as described above.
- **Hash-based routing (`/#/employees`).** Needs nothing from CloudFront. Rejected: uglier URLs, and it changes how every link in the app works.
- **Lambda@Edge.** More capable, but slower, billed per request, and has to be deployed in us-east-1, all for a one-line rewrite.
