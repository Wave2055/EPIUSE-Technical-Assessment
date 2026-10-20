# ADR-0035: Run end-to-end tests on a full Docker build of the application

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** Jaitin
- **Related:** [ADR-0020](0020-test-database-triggers-with-testcontainers.md) (amended), [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md), [ADR-0025](0025-rate-limit-by-client-address.md), [ADR-0026](0026-self-migrating-api-image-released-by-tag.md), [ADR-0034](0034-harden-the-public-web-surface.md)

## Context

[ADR-0020](0020-test-database-triggers-with-testcontainers.md) limited end-to-end testing to one happy path, run by hand against `pnpm dev` and a local database. That left three gaps:

1. **The tested build was not the shipped build.** The Vite dev server and `nest start` differ from the production image and the static bundle, in exactly the places that break on deploy: missing files in the image, migrations run at startup, production-only settings such as required origin secrets and secure cookies.
2. **The production request path went untested.** CloudFront adds the origin secret and the viewer address, serves the SPA's routes, answers dotfile probes with 404 and sends the CSP ([ADR-0016](0016-single-cloudfront-distribution-dual-origin.md), [ADR-0034](0034-harden-the-public-web-surface.md)). None of that exists under `pnpm dev`.
3. **One path covers little.** Roles, refusals, deletion strategies, task assignment, filters and the security headers were tested only below the browser, if at all.

## Decision

**Build and run the whole application in Docker for the end-to-end tests**, from source, on every run (`e2e/docker-compose.yml`):

| Service | What it is                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------ |
| `db`    | PostgreSQL 17, in memory                                                                         |
| `api`   | The production image from `apps/api/Dockerfile`, in production mode; it migrates itself on start |
| `edge`  | The production web build behind Caddy, configured to do what CloudFront does                     |

The **edge** stands in for CloudFront: it adds the origin secret and `CloudFront-Viewer-Address` to `/api/*`, serves `index.html` for routes without an extension, answers 404 for dot-paths, and sends the same response headers. Its CSP is compared with the Terraform policy by a test, so the two cannot drift apart silently.

`pnpm test:e2e:docker` (`scripts/e2e-docker.sh`) clears any earlier stack, generates random secrets, builds and starts the stack, seeds it from inside the API image, runs every Playwright spec, and tears everything down. CI runs it on every push and pull request.

**The browser suite covers each user-facing rule**, not one path:

- signing in, wrong passwords, form validation, sessions surviving a reload, signing out, and the login rate limit;
- a viewer seeing no salaries and no way to change anything;
- searching, filtering and sorting the table; form errors, including a duplicate employee number; the manager picker never offering someone's own team;
- both deletion strategies and the multiple-roots warning;
- adding and ticking off tasks, and a manager assigning one that the report then sees;
- the public surface: headers, the CSP matching Terraform with no violations on any page, dotfile 404s, no source maps, no API docs, every data route behind sign-in, and the refresh cookie's flags.

Each test is a separate viewer for rate limiting: Playwright sends a unique `X-E2E-Client`, which the edge forwards as the viewer address. Tests that change data create their own records and remove them, so the suite can rerun against the same database.

The integration suite ([ADR-0020](0020-test-database-triggers-with-testcontainers.md)) gains a matching edge-case suite: malformed and oversized bodies, forged, expired and unsigned tokens, boundary values, every refusal, and the origin check. It found two bugs, both fixed alongside: `%` and `_` in a search acted as wildcards, and an oversized request body answered 500 instead of 413.

## Consequences

### Positive

- The images tested are built the same way as the images deployed, so a missing file, a failed migration or a production-only setting fails in CI, not on deploy.
- The CloudFront behaviour the app depends on is exercised on every change, even though CloudFront itself is not.
- One command runs the suite on any machine with Docker, with nothing to configure and no secrets to share.

### Negative

- **Slower.** Building both images and running the suite takes a few minutes, against seconds for the unit tests.
- **The edge is a copy.** Caddy is not CloudFront. The CSP is checked against Terraform automatically; the routing rules are not, and must be changed in both places.
- One browser (Chromium) only.
- The suite shares one database, so tests run one at a time.

## Alternatives considered

- **Run Playwright against the live deployment after each deploy.** Tests the real CloudFront, but only after a change is already live, and leaves test data in the production database.
- **LocalStack for CloudFront.** Its CloudFront support is limited and needs a paid tier for parts of it; a few lines of Caddy cover what the app relies on.
- **Mock the API in the browser tests.** Fast, but the brief forbids mocked data, and it would test neither the API nor the database.
