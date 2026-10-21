# ADR-0034: Harden the public web surface

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** Jaitin
- **Related:** [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md), [ADR-0027](0027-spa-routing-with-a-cloudfront-function.md), [ADR-0033](0033-keep-api-docs-off-the-public-deployment.md)

## Context

An external scan of the live site reported two high-severity issues; the free plan does not include the report. Probing the site from outside, as a scanner would, turned up three problems on the web side. (The API already sends helmet's headers, and its origin admits only CloudFront.)

1. **Source maps were public.** The web build had `sourcemap: true`, and every `.js` file under `/assets` had a downloadable `.js.map` beside it holding the app's full original source, comments included.
2. **No Content-Security-Policy.** The SPA used CloudFront's managed `SecurityHeadersPolicy`, which sets HSTS, `nosniff`, frame options and a referrer policy, but no CSP. Nothing limited where scripts could load from, so any injected markup would run with the user's session.
3. **`/.git/config` answered 200.** The routing function ([ADR-0027](0027-spa-routing-with-a-cloudfront-function.md)) serves the app shell for any path without a file extension. `/.git/config`, `/.git/HEAD` and similar returned `index.html` with a 200, which scanners report as an exposed repository. Nothing was exposed, but a 200 there is indistinguishable from a real leak without reading the body.

## Decision

**Build without source maps.** `sourcemap: false` in the Vite config. The deploy's `aws s3 sync --delete` removes the maps already in the bucket on the next deploy.

**Send our own response headers policy** on the SPA and `/avatars/*` behaviours, replacing the managed one:

| Header                    | Value                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content-Security-Policy   | `default-src 'self'`; `script-src 'self'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob: https://gravatar.com`; `font-src 'self' data:`; `connect-src 'self'` plus the avatar bucket; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests` |
| Strict-Transport-Security | Two years, including subdomains                                                                                                                                                                                                                                                                                             |
| X-Frame-Options           | `DENY`                                                                                                                                                                                                                                                                                                                      |
| X-Content-Type-Options    | `nosniff`                                                                                                                                                                                                                                                                                                                   |
| Referrer-Policy           | `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                                                           |
| Permissions-Policy        | Camera, microphone, geolocation, payment and USB off                                                                                                                                                                                                                                                                        |

Scripts are limited to the site's own files, with no inline scripts and no `eval`. Zod's validators probe for `eval` as schemas are defined, so the web app sets zod's `jitless` mode before anything else loads. Styles allow `'unsafe-inline'` because React, Radix and React Flow set inline `style` attributes; style injection cannot run script.

**Answer 404 for any path through a dot-segment** (`/.git/…`, `/.aws/…`) in the routing function, before the app-shell rewrite.

The API's headers are unchanged; helmet already sets them.

## Consequences

### Positive

- The app's source is no longer published.
- An injected `<script>` or a script from another host will not run, which limits the damage of any future XSS bug.
- Probes for dotfiles get an honest 404.

### Negative

- **Production errors have no source maps.** Stack traces point into minified bundles. There is no error-reporting service to upload private maps to, so this costs little now.
- **A new external host must be added to the CSP.** A font CDN or analytics script, for example, would be blocked until it is.
- `'unsafe-inline'` for styles is weaker than nonces or hashes. Nonces need a server rendering each page, which a static SPA on S3 does not have.
- The headers policy is CloudFront configuration, so it changes with `terraform apply`, not with an application deploy.

## Alternatives considered

- **`sourcemap: 'hidden'`.** Drops the comment that points at the map, but still writes the maps into `dist`, so the deploy would still publish them.
- **CSP as a `<meta>` tag in `index.html`.** Lives with the app, but cannot set `frame-ancestors`, and only covers the HTML page.
- **CSP in report-only mode first.** The safer rollout for a large app. Here every page was checked under the enforced policy before release (a local server sending the same header, with no violations across home, employees, org chart and audit), so enforcing straight away was judged acceptable.
- **An allow-list of app routes in the routing function.** Would 404 every unknown path, not just dot-paths, but has to change with every new route.
