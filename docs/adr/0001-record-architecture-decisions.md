# ADR-0001: Record architecture decisions in ADRs

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** all subsequent ADRs

## Context

The EPI-USE technical assessment (`docs/Technical Services - Assessment v2.1.pdf`) requires "a short technical document ... whereby you explain the architecture of the solution, design patterns used, technologies, and justification on why you feel this was the best way to build the solution."

The brief is explicitly and deliberately vague ("intentionally vague in order to give you freedom when designing the solution"). That freedom means nearly every choice in this repository is a _decision with alternatives_, not an inevitability. A single flat technical document tends to present such choices as settled fact and quietly discards the reasoning — which is precisely what is being assessed.

## Decision

Capture each significant architectural decision as a numbered, immutable Architecture Decision Record in `docs/adr/`, following Michael Nygard's format as popularised by MADR.

- Records are numbered sequentially and never renumbered.
- A record is never edited once Accepted, except to change its Status. To reverse a decision, write a new ADR that supersedes the old one, and mark the old one `Superseded by ADR-XXXX`.
- `docs/technical-document.md` is written as a narrative summary that links into this stack rather than duplicating it.

## Consequences

### Positive

- The technical document deliverable gains its "justification" section almost for free, with the alternatives preserved rather than lost.
- Reviewers can see _what was considered and rejected_, which is a stronger signal of engineering judgement than the final answer alone.
- Decisions carry their context, so a later reader can tell whether a constraint still holds (notably the AWS free-tier constraints in ADR-0015 and ADR-0021, which expire).

### Negative

- Ongoing discipline: a change of direction means writing a new record, not editing an old one.
- Some duplication between the ADR stack and the narrative technical document.

## Alternatives considered

- **A single technical document only.** The required deliverable, but it flattens decisions into assertions and loses rejected alternatives.
- **Decisions captured in commit messages.** Durable and already required by the brief's git repository rule, but not discoverable by an assessor reading the repository.
