# User stories

What the application is for, written from the side of the people who use it. Each story names the brief requirement it comes from, how the application meets it, and where the reasoning is recorded.

## The problem

EPI-USE Africa needs one place, reachable at a URL, to keep its employee records and the reporting lines between them. People need to see the shape of the organisation, find someone quickly, and change records without breaking the structure: nobody may manage themselves, directly or through a chain of reports. Every change must be stored in a real database, not mocked.

## Who uses it

| Persona                 | Account role | What they need                                                          |
| ----------------------- | ------------ | ----------------------------------------------------------------------- |
| **HR administrator**    | `ADMIN`      | Maintain employee records and reporting lines, and see who changed what |
| **Employee or manager** | `VIEWER`     | Look up colleagues and the org chart without seeing pay                 |
| **Assessor**            | either       | Open a URL and evaluate the whole solution, with no setup               |

## Stories

### Managing employee records

**US-01 — Add an employee.** As an HR administrator, I want to add an employee with their name, surname, birth date, employee number, salary, role and manager, so that the organisation's records are complete.

- The form validates every field before saving, with the same rules the API enforces (one shared schema, [ADR-0003](adr/0003-typescript-monorepo-with-shared-schemas.md)).
- Employee numbers and email addresses must be unique. A duplicate is refused with a message saying which field clashed.
- The record is written to PostgreSQL and appears in the table and chart immediately ([ADR-0006](adr/0006-postgresql-via-prisma.md)).
- Email is required as well, because Gravatar is looked up by email ([ADR-0012](adr/0012-require-email-on-employee-record.md)).

**US-02 — Edit an employee.** As an HR administrator, I want to change any field of an employee's record from the table or the org chart, so that records stay current.

**US-03 — Delete an employee without orphaning their team.** As an HR administrator, I want to choose what happens to a manager's direct reports when I delete the manager, so that nobody is left reporting to a person who no longer exists.

- The delete dialog lists the direct reports who will move.
- **Promote** moves them up to the deleted manager's own manager. **Reassign** moves them to a manager I pick ([ADR-0010](adr/0010-explicit-deletion-strategies.md)).
- The database refuses to delete a manager whose reports have not been moved, so the rule holds even if the API is bypassed.

### Controlling the reporting structure

**US-04 — Set a reporting line.** As an HR administrator, I want to set or change who an employee reports to, so that the hierarchy reflects the real organisation.

**US-05 — Prevent impossible reporting lines.** As an HR administrator, I want the system to stop me making anyone their own manager, directly or through a chain, so that the hierarchy can always be drawn as a tree.

- The manager picker leaves out the employee and everyone below them, so a loop cannot be chosen.
- The API checks again before saving, and a database trigger checks a third time, so a loop is refused however the request arrives ([ADR-0008](adr/0008-defence-in-depth-cycle-prevention.md)).

**US-06 — Allow employees with no manager.** As an HR administrator, I want to leave the manager empty for someone like the CEO, so that the top of the organisation can be represented.

- An empty manager is valid. If more than one person has no manager, the chart shows a warning instead of refusing, since it may be deliberate during a restructure ([ADR-0009](adr/0009-permit-multiple-hierarchy-roots.md)).

### Seeing and finding people

**US-07 — See the organisation as a chart.** As any user, I want an interactive org chart, so that I can understand who reports to whom at a glance.

- The **Hierarchy** page draws the whole organisation as a tree that can be panned and zoomed, with each person's photo, name and role ([ADR-0007](adr/0007-adjacency-list-for-the-hierarchy.md), [ADR-0031](adr/0031-load-the-whole-organisation-into-the-client.md)).

**US-08 — Search the hierarchy, then act.** As an HR administrator, I want to search the chart by name, role or employee number and then edit or delete the person I find, so that I don't have to hunt through the tree.

- Choosing a result centres the chart on that person and opens their details, with **Edit** and **Delete** for administrators.

**US-09 — Sort and filter a list of employees.** As any user, I want a table of all employees that I can sort and filter, so that I can answer questions like "who are all the developers under Thandi?".

- Every column sorts: first name, surname, employee number, role, manager, birth date and salary.
- A search box matches name, employee number, email and role. Dropdowns filter by role and by manager, **Details** filters first name, surname, employee number and email one at a time, and birth date and salary filter by a range.
- Sorting and filtering happen in the browser, so they respond instantly ([ADR-0005](adr/0005-react-vite-spa-for-the-web-client.md)).

### Avatars

**US-10 — See each employee's face.** As any user, I want to see each employee's Gravatar next to their name, so that I can recognise colleagues.

- The avatar is looked up from the employee's email. Where there is no Gravatar, the employee's initials are shown instead ([ADR-0013](adr/0013-avatar-resolution-chain.md)).

**US-11 — Upload a photo.** _(Optional in the brief.)_ As an HR administrator, I want to upload a photo for an employee who has no Gravatar, so that everyone has a recognisable picture.

- **Upload picture** on the edit form takes a PNG, JPEG or WebP of up to 2 MB. The API issues a presigned upload and the browser sends the file straight to S3. An uploaded photo takes priority over Gravatar, and **Remove picture** falls back to Gravatar, then initials.

### Access, privacy and accountability _(beyond the brief)_

**US-12 — Sign in.** As a user, I want to sign in once and stay signed in while I work, so that the application is not open to anyone who finds the URL. There is no public sign-up: access is given by an admin (US-18).

- Sessions renew in the background and survive a page reload ([ADR-0014](adr/0014-self-hosted-jwt-auth-and-salary-masking.md), [ADR-0030](adr/0030-web-session-renewal.md)).
- Password guessing is limited to 10 attempts per 15 minutes per address ([ADR-0025](adr/0025-rate-limit-by-client-address.md)).

**US-13 — Keep salaries private.** As an employee with a `VIEWER` account, I can browse the organisation but cannot see salaries, so that pay stays confidential.

- The API masks salaries before they leave the server. The table also refuses to sort or filter on salary for a viewer, which would otherwise reveal who earns more.
- Viewers see no add, edit or delete controls, and the API refuses those actions from them anyway.

**US-14 — See who changed what.** As an HR administrator, I want a log of every create, edit and delete, with who did it, when, and each field's old and new value, so that mistakes can be traced and undone by hand.

- A database trigger records every change, so nothing can bypass the log ([ADR-0011](adr/0011-audit-trail-via-database-triggers.md)). The **Audit** page filters it by action and loads it 50 entries at a time.

**US-15 — See my own team and tasks.** As a signed-in employee, I want a home page showing my profile, my direct reports and my to-do list, so that the application is useful day to day, not only to HR ([ADR-0022](adr/0022-home-screen-tasks-and-user-employee-link.md)).

- I can add, update and delete my own tasks, and see my direct reports' tasks.
- Tasks my manager gave me show who they came from, and stay mine to update or remove.

**US-16 — Give my team work.** As a manager, I want to add a task to a direct report's list, so that I can delegate from the same place I see what the team is working on ([ADR-0032](adr/0032-managers-assign-tasks-to-direct-reports.md)).

- The team view has an add row under each direct report. Only direct reports can be given tasks, and the API refuses anyone else.
- I can change or delete a task I assigned while that person still reports to me.

### Accounts _(beyond the brief)_

**US-18 — Give a new colleague access.** As an HR administrator, I want adding an employee to give them a login, so that everyone I add can sign in without anyone touching the server ([ADR-0036](adr/0036-every-employee-has-a-login-managed-by-admins.md)).

- The new login is a regular user, signing in with the employee's email.
- I see a one-time password once, to pass on privately; nobody can see it again.

**US-19 — Choose my own password.** As a new user, I want to replace the password I was given with my own, so that only I know it.

- Signing in with a one-time password takes me straight to choosing my own; nothing else works until I do.
- I can change my password at any time from the account menu.

**US-20 — Make someone an admin, or take it away.** As an HR administrator, I want to promote a regular user to admin and back, so that I can share or hand over administration.

- It takes effect on their next click; demotion also signs them out.
- I cannot change my own access, and the last admin can never be removed, so the system is never left without one.

**US-21 — Stop someone signing in.** As an HR administrator, I want to deactivate a login without deleting the person, so that a leaver loses access at once but their record and history stay.

**US-22 — Help someone who forgot their password.** As an HR administrator, I want to reset a password, so that the person can get back in; the old password and their sessions stop working.

**US-23 — See who changed access.** As an HR administrator, I want every account change in the audit trail, so that promotions, deactivations and resets are accountable.

### Delivery

**US-17 — Use it from a URL.** As an assessor, I want to open one link and use the live system, so that I can evaluate it without installing anything.

- Live at https://d1qxvq2ahpxf8h.cloudfront.net. One address serves both the web app and the API ([ADR-0016](adr/0016-single-cloudfront-distribution-dual-origin.md)).
- All data lives in PostgreSQL on AWS and is backed up to S3 nightly. Nothing in the submitted app is mocked ([ADR-0023](adr/0023-postgresql-container-on-the-api-instance.md), [ADR-0031](adr/0031-load-the-whole-organisation-into-the-client.md)).
- Every change merged to `main` is tested and deployed automatically ([ADR-0019](adr/0019-github-actions-oidc-cicd.md), [ADR-0026](adr/0026-self-migrating-api-image-released-by-tag.md)).

## Coverage of the brief

| Brief requirement                                                        | Stories                        |
| ------------------------------------------------------------------------ | ------------------------------ |
| Create, read, update and delete employees                                | US-01, US-02, US-03            |
| Set a reporting line manager                                             | US-04                          |
| No one may be their own manager                                          | US-05                          |
| Employees with no manager (e.g. the CEO)                                 | US-06                          |
| Minimum fields: name, surname, birth date, number, salary, role, manager | US-01                          |
| Visual hierarchy (tree or graph)                                         | US-07                          |
| Search the hierarchy to find, edit or delete                             | US-08                          |
| Table sortable and filterable on any field                               | US-09                          |
| Gravatar integration                                                     | US-10                          |
| Avatar upload _(optional)_                                               | US-11                          |
| Deployed to the cloud at a URL                                           | US-17                          |
| No mocked data; changes stored in a remote database                      | US-17                          |
| Additional features                                                      | US-12 to US-16, US-18 to US-23 |
