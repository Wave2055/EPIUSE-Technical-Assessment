# ADR-0030: Restore and renew web sessions from the refresh cookie, one request at a time

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Jaitin
- **Related:** implements the client side of [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)

## Context

[ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md) keeps the 15-minute access token in memory only, with the refresh token in an `httpOnly` cookie. The cookie is rotated on every use, and **reusing a rotated cookie revokes the whole session**, which is the reuse detection that makes rotation worth having. That leaves the web client three problems:

1. The access token is lost on every page load, so a signed-in user would be sent to the login page on each refresh.
2. It expires every 15 minutes during normal use.
3. Renewing it must never happen twice at once. Two parallel refreshes present the same cookie: the second counts as a replay, and the API signs the user out. This happens easily: several requests can expire together, and React's StrictMode runs effects twice in development.

## Decision

- **Restore on load.** Before the first render, the app calls `POST /api/auth/refresh` once. Nothing protected renders until it answers: the user is then either signed in or sent to `/login`, and returns to the page they asked for after signing in.
- **Renew on expiry.** When a request returns 401, the API client renews the token and retries the request once. If renewal fails, the session is marked expired and the user goes to sign in. The auth routes themselves are never retried, so a failed login reports its own error.
- **One renewal at a time.** All callers share a single in-flight refresh promise, so the rotating cookie is presented exactly once.
- **Signing out** calls `/api/auth/logout`, which revokes the cookie's session, and clears the access token and every cached response, so the next user on the same browser starts clean.
- **Roles come from the session**, never from the UI. The design's "preview as viewer" toggle is removed. Salary masking stays enforced by the API.

## Consequences

### Positive

- Users stay signed in across reloads and token expiry, while no credential is ever readable by page script.
- Reuse detection stays on without signing people out by accident.
- Unit tests (`apps/web/src/lib/api-client.test.ts`) pin down the single-flight behaviour, the retry and the expiry path.

### Negative

- Two tabs refreshing at the same instant can still race across tabs, since the single flight is per tab, and one of them may be signed out. Rare in practice; a `BroadcastChannel` lock would close it.
- Every page load costs one extra request before the first screen appears.

## Alternatives considered

- **Keep the access token in `localStorage`.** Survives reloads with no refresh call, but hands a bearer token to any script that runs on the page, which [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md) rules out.
- **Renew proactively on a timer.** Avoids failed requests, but still needs the 401 path for sleep, suspended tabs and clock skew, so it adds code without removing any.
- **Turn off refresh-token reuse detection.** Removes the race by removing the protection. Rejected.
