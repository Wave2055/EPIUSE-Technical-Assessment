# ADR-0012: Add a required email field to the employee record

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Jaitin
- **Related:** [ADR-0013](0013-avatar-resolution-chain.md), [ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)

## Context

The brief specifies the employee record: _"As a minimum, an employee's data record should contain name, surname, birth date, employee number, salary, role/position, and reporting line manager."_

The same brief also requires: _"it is required that Gravatar ... be integrated into the platform to allow an employee to have an avatar profile picture linked to their employee data."_

**These two requirements are in tension.** Gravatar is addressed entirely by a hash of an email address — `https://gravatar.com/avatar/{hash(email)}`. There is no other lookup key. The specified minimum field list contains no email, so the Gravatar requirement is unsatisfiable against it.

The phrase _"as a minimum"_ resolves the tension: the field list is a floor, not a ceiling. Adding a field is expected. But because a reviewer is checking the implementation against that list, the addition should be deliberate and recorded rather than silent.

## Decision

Add `email` to the employee record as a **required, unique** field:

```sql
email citext UNIQUE NOT NULL
```

- `citext` so that `J.Moodally@epiuse.com` and `j.moodally@epiuse.com` cannot both exist. Email addresses are case-insensitive in practice, and uniqueness must reflect that.
- **Required**, not nullable, because an optional email would make avatar behaviour inconsistent for no gain — every employee in an organisation of this kind has a work address.
- Normalised to trimmed lowercase on write, which is also what Gravatar hashing requires ([ADR-0013](0013-avatar-resolution-chain.md)).

The deviation and its justification are called out explicitly in the technical document, not just here.

## Consequences

### Positive

- Makes the mandatory Gravatar integration possible at all.
- Gives the reporting table a genuinely useful search field, and gives the system a natural person-identifier beyond the employee number.
- Uniqueness on email is a real data-quality guard against duplicate employee records.

### Negative

- The implemented schema no longer matches the brief's field list literally, which requires explanation — this ADR and a technical-document note.
- Email is personal data, which raises the data-protection profile of the record (relevant under POPIA for a South African employer) and means it must not leak into unauthenticated responses.
- Required-and-unique makes CSV import stricter: a row without an email, or duplicating one, is rejected. This is intentional but must be clearly reported in the import dry-run.

## Alternatives considered

- **Nullable email with a Gravatar fallback when absent.** More permissive on import. Rejected: produces two classes of employee with different avatar behaviour, for no real benefit given every employee has an address.
- **Derive a synthetic email from the employee number** (`emp-00042@epiuse.local`). Keeps the field list literally intact. Rejected: the hash of a synthetic address matches no real Gravatar account, so the integration would be decorative — satisfying the letter of the requirement while defeating its purpose.
- **Hold the email only on the separate auth user record** ([ADR-0014](0014-self-hosted-jwt-auth-and-salary-masking.md)). Technically avoids touching the employee schema. Rejected: most employees are not system users, so most would have no avatar; it conflates "person in the org chart" with "person who can log in".
