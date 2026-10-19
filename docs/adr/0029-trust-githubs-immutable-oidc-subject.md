# ADR-0029: Trust GitHub's immutable OIDC subject

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** Jaitin
- **Related:** amends the trust policy of [ADR-0019](0019-github-actions-oidc-cicd.md)

## Context

[ADR-0019](0019-github-actions-oidc-cicd.md) restricts the deploy role to tokens whose `sub` claim names this repository and its `main` branch. The usual subject format is:

```
repo:Wave2055/EPIUSE-Technical-Assessment:ref:refs/heads/main
```

The first automatic deploy failed at AWS sign-in with `Not authorized to perform sts:AssumeRoleWithWebIdentity`. This repository's tokens use GitHub's **immutable subject** format, which carries the owner and repository IDs as well as their names:

```
repo:Wave2055@186425095/EPIUSE-Technical-Assessment@1420389825:ref:refs/heads/main
```

The trust policy compared the two with `StringEquals`, so they never matched.

The name-only form also carries a known weakness: if the repository or its owner is renamed, a different repository can later take the old name and present a matching subject.

## Decision

The deploy role trusts **both subject forms**, each still limited to this repository's `main` branch. The IDs are a Terraform variable (`github_repository_ids`), and its description shows how to look them up with `gh api`. Setting it to `null` leaves only the name-only form, for a repository that does not use immutable subjects.

## Consequences

### Positive

- Deploys work whichever format GitHub sends.
- The ID-based subject binds the role to this exact repository: it survives a rename, and a newcomer reusing the name cannot match it.

### Negative

- Accepting the name-only form as well keeps its weakness. Once the immutable format is confirmed stable for this repository, the name-only form can be dropped.
- The trust policy now depends on two numeric IDs that are not obvious from the repository's name.

## Alternatives considered

- **Only the immutable form.** The strongest binding, but deploys would break if the repository's subject setting changed back.
- **A wildcard such as `repo:Wave2055*`.** Matches either form, but widens trust beyond this repository and branch, exactly the too-broad policy [ADR-0019](0019-github-actions-oidc-cicd.md) warns against.
- **Switching the repository back to the name-only subject.** Possible in the repository's settings, but it gives up the rename protection to suit the policy, rather than the other way round.
