# ADR-0013: Resolve avatars server-side through a fallback chain

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0012](0012-require-email-on-employee-record.md), [ADR-0016](0016-single-cloudfront-distribution-dual-origin.md)

## Context

The brief requires Gravatar integration, and separately notes: _"The application does not need to allow users to upload profile pictures, but rather only display them, however, we do promote building in upload functionality as an optional nice-to-have feature."_ Upload was selected as in-scope.

That produces three possible sources for one employee's avatar, in descending priority: an uploaded image, a Gravatar registered against their email, or nothing at all. Most employees will fall into the third case — Gravatar coverage in a corporate directory is low, and `d=mp`'s generic silhouette makes an org chart of fifty identical grey figures, which is worse than useless for navigation.

Resolution could happen on the client (which knows about image load failures) or on the server (which knows about the stored upload).

## Decision

Resolve the avatar **server-side** into a single `avatarUrl` on every employee DTO, implemented as a **Chain of Responsibility**:

1. `avatar_key` is set → return the CloudFront URL of the uploaded image.
2. Otherwise → return `https://gravatar.com/avatar/{sha256(trim(lower(email)))}?s=160&d=404`.
3. The `d=404` is the hand-off: when no Gravatar exists the request 404s, the client's `onError` fires, and the UI renders a **generated initials avatar** with a colour derived deterministically from the employee id.

Implementation notes:

- **SHA-256, not MD5.** Gravatar supports both; MD5 is the legacy default and is cryptographically broken. Nothing here depends on collision resistance, but there is no reason to ship a broken hash.
- Uploads use a **presigned S3 `PUT`** issued by the API, with content-type and a 2 MB size cap enforced in the presign conditions — **not** in the UI, since client-side limits are advisory.
- Objects are stored at `avatars/{employeeId}/{uuid}.webp`; the random component prevents a stale CDN cache serving a replaced image.

## Consequences

### Positive

- One source of truth for avatar logic. The client renders `avatarUrl` and handles one error case; it holds no knowledge of Gravatar, hashing or S3 keys.
- The org chart stays navigable because every node has a visually distinct avatar, Gravatar or not.
- Upload bytes never pass through the API, so the `t3.micro` ([ADR-0015](0015-ec2-docker-for-api-compute.md)) is not a bottleneck and needs no multipart handling.
- Changing the avatar policy later is a server-side change requiring no client release.

### Negative

- `d=404` means the browser makes a request that is _expected_ to fail for most employees, producing console noise and a wasted round trip per uncovered employee. Mitigated by CDN and browser caching of the negative result.
- Avatar URLs are generated per response rather than stored, so a change in strategy invalidates client caches wholesale.
- Serving the employee's Gravatar discloses to a third party that this email exists in the directory, and does so from each viewer's browser. Acceptable for an internal tool and inherent to the brief's requirement, but worth recording.
- Presigned URLs are bearer credentials for the duration of their validity; they are issued short-lived (5 minutes) and scoped to a single key.

## Alternatives considered

- **Client-side Gravatar hashing.** Avoids an API concern entirely. Rejected: duplicates the fallback logic into the client, and requires the client to handle `crypto.subtle` for every rendered node.
- **`d=mp` or `d=identicon` as the Gravatar default.** One request, no error handling, always an image. Rejected for `mp` (fifty identical silhouettes); `identicon` is a genuine contender — distinct per email and zero client logic — but produces abstract patterns that are harder to associate with a person than their actual initials.
- **Proxy and cache Gravatar images through the API.** Removes the third-party disclosure and the 404 noise. Rejected as unnecessary bandwidth and complexity on a free-tier instance.
- **Store an uploaded avatar as a `bytea` column.** Keeps everything in one store. Rejected: bloats the database, cannot be CDN-cached, and routes image traffic through the API.
