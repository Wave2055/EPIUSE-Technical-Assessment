# ADR-0016: Serve the SPA and the API from one CloudFront distribution

- **Status:** Accepted; the 403/404 → `/index.html` rule superseded by [ADR-0027](0027-spa-routing-with-a-cloudfront-function.md); response headers and dot-path 404s per [ADR-0034](0034-harden-the-public-web-surface.md)
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0002](0002-separate-api-and-web-deployables.md), [ADR-0005](0005-react-vite-spa-for-the-web-client.md), [ADR-0015](0015-ec2-docker-for-api-compute.md)

## Context

Splitting the API and SPA into separate deployables ([ADR-0002](0002-separate-api-and-web-deployables.md)) normally introduces two further problems:

1. **CORS.** Two origins means preflight requests, an `Access-Control-Allow-Origin` allowlist, and `credentials: 'include'` handling for the refresh cookie ([ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)) — along with the `SameSite` complications of a cross-site cookie.
2. **TLS on the API.** Caddy's automatic Let's Encrypt certificates require a registered domain pointing at the instance. The brief requires the solution be "easily accessible via a provided URL", and buying a domain for an assessment is friction.

## Decision

Use a **single CloudFront distribution with two origins**, routed by path:

| Path     | Origin                   | Notes                                                      |
| -------- | ------------------------ | ---------------------------------------------------------- |
| `/api/*` | EC2 instance (HTTP)      | No caching; forward all headers, cookies, query strings    |
| `/*`     | S3 bucket (private, OAC) | Cached; 403/404 rewritten to `/index.html` for SPA routing |

Consequences that fall out of this:

- **The browser sees exactly one origin, so there is no CORS configuration anywhere in the system.** The refresh cookie is same-site.
- TLS is provided free by the default `*.cloudfront.net` certificate — **no domain purchase required**.
- The S3 bucket stays private, reachable only via Origin Access Control.
- The EC2 origin accepts `:80` only from CloudFront's managed prefix list `com.amazonaws.global.cloudfront.origin-facing`, plus a shared secret header injected by CloudFront, so the origin cannot be reached directly.
- One URL is handed to the assessors for the whole application.

## Consequences

### Positive

- Eliminates an entire category of configuration and bugs — CORS and cross-site cookies — rather than solving them.
- Free TLS with no domain, no ACM certificate, no DNS.
- CloudFront's always-free tier (1 TB egress, 10M requests/month) covers this comfortably.
- The SPA is globally cached at edge locations; only `/api/*` reaches the single instance from [ADR-0015](0015-ec2-docker-for-api-compute.md), which is exactly the right division of load.

### Negative

- **CloudFront-to-origin traffic is plain HTTP.** Encrypted from browser to edge, unencrypted from edge to EC2 within AWS's network. Mitigated by the prefix-list restriction and the shared secret, but it is genuinely weaker than end-to-end TLS and would not be acceptable for production — the fix is ACM plus a custom domain.
- CloudFront distribution changes propagate slowly (5–15 minutes), which makes iterating on routing behaviour tedious.
- Every deploy of the SPA needs a cache invalidation, which is an easy step to forget and produces confusing stale-asset bugs.
- The `*.cloudfront.net` URL is opaque and unmemorable.

## Alternatives considered

- **Separate domains for API and SPA with full CORS.** The conventional split. Rejected: requires a domain, an ACM certificate, DNS, and correct CORS plus `SameSite=None` cookie handling — significant configuration surface for no benefit here.
- **Caddy with automatic Let's Encrypt on a custom domain.** Gives true end-to-end TLS and a memorable URL, and Caddy is already in the stack. Rejected only because it requires registering a domain. **This is the upgrade path if a domain becomes available.**
- **Serving the SPA from Caddy on the same instance.** One origin, no CloudFront at all, simplest possible topology. Rejected: puts static-asset traffic on the `t3.micro`, discards edge caching, and reintroduces the TLS problem.
