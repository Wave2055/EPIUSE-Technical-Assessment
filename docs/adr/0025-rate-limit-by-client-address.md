# ADR-0025: Rate-limit every API route by client address

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Jaitin
- **Related:** [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md), [ADR-0015](0015-ec2-docker-for-api-compute.md), [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md)

## Context

[ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md) accepted hand-rolled authentication with no account lockout. Deployed at a public URL, `POST /api/auth/login` would let anyone try passwords as fast as the network allows, and every other route could be flooded at no cost to the sender.

Limiting by client address raises a problem specific to this topology. Every request reaches the API through CloudFront and then Caddy, so to the API every visitor appears to have Caddy's address, and a naïve per-IP limit would put all users in one shared bucket.

The origin-secret check ([ADR-0016](0016-single-cloudfront-distribution-dual-origin.md)) was also optional: an unset `ORIGIN_SECRET` silently disabled it.

## Decision

Rate-limit every route with `@nestjs/throttler`, applied as the first global guard so a flood is refused before any token is verified:

| Route                  | Limit                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| Every route            | 300 requests a minute, per client address, per route                   |
| `POST /api/auth/login` | 10 attempts per 15 minutes, then the address is blocked for 15 minutes |
| `GET /api/health`      | Not limited; the container and Caddy health checks poll it             |

Refused requests get `429` with the shared error shape (`RATE_LIMITED`) and a `Retry-After` header.

**The client address** comes from the `CloudFront-Viewer-Address` header, which CloudFront sets itself and overwrites if a viewer sends one. The `/api/*` behaviour uses the managed `AllViewerAndCloudFrontHeaders-2022-06` origin request policy so the header arrives. The API trusts the header **only while the origin-secret check is on**: then every request provably came through CloudFront. Without the check, any client could send its own header and get a fresh bucket every time, so the API falls back to the socket address.

To make that condition hold in production, **`ORIGIN_SECRET` is now required when `NODE_ENV=production`**. The API refuses to start without it, rather than silently running with the origin open.

Counters are kept in memory. The API runs as one instance ([ADR-0015](0015-ec2-docker-for-api-compute.md)), so there is no shared store to keep in step.

## Consequences

### Positive

- Password guessing against the public login drops to ten attempts per address per quarter hour.
- A missing origin secret is now a startup failure, not a silent hole.
- Limits are visible to clients through `X-RateLimit-*` headers, and the web client shows the API's message.

### Negative

- **Counters reset on every deploy or restart**, which briefly lifts the limits.
- Per address, not per account: an attacker spread across many addresses is not slowed, and an office behind one NAT shares one login budget.
- Correct limits depend on the CloudFront origin request policy. Without the viewer-address header, everyone shares Caddy's bucket. This is now set in Terraform rather than left to memory.

## Alternatives considered

- **AWS WAF rate-based rules on CloudFront.** Managed, and stops floods before they reach the instance. Rejected on cost: about $5 a month for the web ACL plus $1 per rule, a large share of the run rate in [ADR-0023](0023-postgresql-container-on-the-api-instance.md).
- **Rate limiting in Caddy.** Rate limiting is not in the standard Caddy build and needs a plugin, which means building a custom Caddy image.
- **Per-account lockout after failed logins.** Stops distributed guessing against one account, but lets anyone lock any user out by guessing badly. Better as a complement than a replacement; left as a follow-up.
- **Trusting `X-Forwarded-For`.** It holds the address of whichever hop last appended to it, and is trivially forged without a strict list of trusted proxies. `CloudFront-Viewer-Address` is set by one known party.
