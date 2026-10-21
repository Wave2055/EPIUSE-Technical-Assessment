# Diagrams

The system drawn from six angles. Each diagram is [Mermaid](https://mermaid.js.org/), which GitHub renders in place, so the diagrams live beside the code and change with it.

1. [System context](#1-system-context): who and what the system talks to
2. [Deployment](#2-deployment-on-aws): what runs where on AWS
3. [Request path](#3-request-path): how one request is routed
4. [Data model](#4-data-model): the tables and their relationships
5. [Sign-in and session renewal](#5-sign-in-and-session-renewal)
6. [Changing a reporting line](#6-changing-a-reporting-line): the two-layer loop check
7. [Deleting a manager](#7-deleting-a-manager)
8. [Avatar resolution](#8-avatar-resolution)
9. [Delivery pipeline](#9-delivery-pipeline)
10. [Test layers](#10-test-layers)
11. [A login's life](#11-a-logins-life)

## 1. System context

```mermaid
flowchart LR
  admin([HR administrator<br/>ADMIN])
  viewer([Employee or manager<br/>VIEWER])
  system[[Employee Hierarchy<br/>web app + API]]
  gravatar[(Gravatar)]
  github[GitHub<br/>repository and Actions]
  aws[(AWS account<br/>eu-west-1)]

  admin -- manages employees, reporting lines, audit --> system
  viewer -- browses org chart and table, own tasks --> system
  system -- avatar images by email hash --> gravatar
  github -- builds, tests and deploys via OIDC --> aws
  aws -- hosts --> system
```

## 2. Deployment on AWS

Everything regional is in eu-west-1 ([ADR-0024](adr/0024-deploy-to-eu-west-1.md)); CloudFront is global. All of it is defined in [`infra/`](../infra) ([ADR-0018](adr/0018-terraform-for-infrastructure.md)).

```mermaid
flowchart TB
  user([Browser])

  subgraph edge[CloudFront, global]
    cf[Distribution<br/>default *.cloudfront.net certificate]
    fn[[Routing function<br/>app routes, dot-path 404s]]
    hdr[[Response headers policy<br/>CSP, HSTS, frame denial]]
  end

  subgraph region[eu-west-1]
    web[(S3: web build<br/>private, OAC)]
    avatars[(S3: avatars<br/>private, OAC)]
    backups[(S3: backups<br/>nightly pg_dump)]

    subgraph vpc[VPC, public subnet, no NAT]
      subgraph ec2[EC2 t3.micro, Amazon Linux 2023]
        compose[Docker Compose<br/>deploy.sh]
        caddy[Caddy :80]
        api[API container<br/>NestJS, Node 22]
        pg[(PostgreSQL 17 container)]
      end
      ebs[(EBS volume<br/>database files)]
    end

    ecr[(ECR: API images<br/>immutable tags)]
    ssm[SSM Parameter Store<br/>current image tag]
    sm[Secrets Manager<br/>app secrets]
  end

  user -- HTTPS --> cf
  cf --- fn
  cf --- hdr
  cf -- "/*" --> web
  cf -- "/avatars/*" --> avatars
  cf -- "/api/* + origin secret<br/>HTTP, CloudFront IPs only" --> caddy
  caddy --> api
  api --> pg
  pg --- ebs
  api -- reads at start --> sm
  compose -- reads tag --> ssm
  compose -- pulls image --> ecr
  pg -. nightly dump .-> backups
```

## 3. Request path

```mermaid
flowchart LR
  req([GET /employees/42]) --> fn{Routing function}
  fn -- "a path segment starts with '.'" --> nf[404]
  fn -- "no file extension" --> index[/index.html/]
  fn -- "has an extension" --> asset[/static file/]
  index --> spa[React app loads,<br/>restores the session,<br/>calls /api/...]
  spa --> api{"/api/*"}
  api --> secret{origin secret<br/>matches?}
  secret -- no --> forbidden[403]
  secret -- yes --> limit{under the<br/>rate limit?}
  limit -- no --> tooMany[429]
  limit -- yes --> jwt{valid<br/>access token?}
  jwt -- no --> unauth[401]
  jwt -- yes --> role{role<br/>allowed?}
  role -- no --> denied[403]
  role -- yes --> handler[validate input,<br/>run the service,<br/>mask salary for viewers]
```

## 4. Data model

Dotted lines are relationships with no foreign key: the audit trail must outlive the employees and users it mentions. The authoritative definition is [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) and its migrations. Database triggers fill `employee_audit` and refuse reporting loops ([ADR-0008](adr/0008-defence-in-depth-cycle-prevention.md), [ADR-0011](adr/0011-audit-trail-via-database-triggers.md)).

```mermaid
erDiagram
  employees ||--o{ employees : "manages (manager_id)"
  employees ||--|| users : "signs in as"
  employees ||--o{ tasks : "owns"
  employees ||--o{ tasks : "assigned (assigned_by)"
  employees ||..o{ employee_audit : "history of (no FK)"
  users ||--o{ refresh_tokens : "sessions"
  users ||..o{ employee_audit : "changed by (no FK)"
  users ||..o{ user_audit : "history of (no FK)"

  employees {
    uuid id PK
    text employee_number UK "E-0000"
    text first_name
    text last_name
    citext email UK "for Gravatar"
    date birth_date
    numeric salary "12,2"
    text position
    uuid manager_id FK "null = top of hierarchy"
    text avatar_key "uploaded picture, optional"
  }
  users {
    uuid id PK
    citext email UK
    text password_hash "argon2id; null until issued"
    enum role "ADMIN or VIEWER"
    uuid employee_id FK, UK "required, cascade"
    bool must_change_password "one-time password in force"
    timestamptz deactivated_at
    timestamptz last_login_at
  }
  user_audit {
    bigint id PK
    uuid user_id "kept after a delete"
    citext email
    text action "CREATE, ROLE_CHANGE, DEACTIVATE, ..."
    uuid changed_by "user id; null = system"
    jsonb details "never a password"
  }
  refresh_tokens {
    uuid id PK
    uuid user_id FK
    text token_hash UK "SHA-256, never the token"
    uuid family_id "rotation family"
    timestamptz expires_at
    timestamptz revoked_at
  }
  employee_audit {
    bigint id PK
    uuid employee_id "kept after a delete"
    text action "CREATE, UPDATE, DELETE, REPARENT"
    uuid changed_by "user id; null = system"
    timestamptz changed_at
    jsonb before
    jsonb after
  }
  tasks {
    uuid id PK
    uuid employee_id FK "owner, cascade"
    uuid assigned_by FK "manager, set null"
    text title
    enum status "todo, in_progress, done"
    date due_date
  }
```

## 5. Sign-in and session renewal

The access token lives only in memory; the refresh token is an httpOnly cookie scoped to `/api/auth`, rotated on every use ([ADR-0014](adr/0014-self-hosted-jwt-auth-and-salary-masking.md), [ADR-0030](adr/0030-web-session-renewal.md)).

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant W as Web app
  participant A as API
  participant D as PostgreSQL

  U->>W: email + password
  W->>A: POST /api/auth/login
  A->>D: find user, verify argon2id hash
  A->>D: store hash of new refresh token (new family)
  A-->>W: access token (15 min) + Set-Cookie refresh (7 days)

  Note over W,A: Later, the access token expires
  W->>A: GET /api/employees (expired token)
  A-->>W: 401
  W->>A: POST /api/auth/refresh (cookie) — one request, however many callers
  A->>D: revoke old token, store its successor in the same family
  A-->>W: new access token + rotated cookie
  W->>A: retry GET /api/employees
  A-->>W: 200

  Note over A,D: A replayed (already rotated) cookie revokes the whole family
  Note over A,D: Every request: the guard reads the login, so role, deactivation<br/>and a one-time password apply at once (ADR-0036)
```

## 6. Changing a reporting line

Two layers refuse a loop: the service explains it, the trigger guarantees it ([ADR-0008](adr/0008-defence-in-depth-cycle-prevention.md)).

```mermaid
sequenceDiagram
  autonumber
  actor Admin
  participant W as Web app
  participant S as API service
  participant T as Database trigger

  Admin->>W: open Edit, choose a manager
  Note over W: picker leaves out the person<br/>and everyone below them
  W->>S: PATCH /api/employees/:id { managerId }
  S->>S: walk up from the new manager (recursive CTE)
  alt the employee is on that path
    S-->>W: 422 HIERARCHY_CYCLE with the chain of names
  else no loop
    S->>T: UPDATE employees (in a transaction tagged with the admin)
    T->>T: check again, then write the REPARENT audit row
    T-->>S: ok
    S-->>W: 200 with the updated employee
  end
```

## 7. Deleting a manager

```mermaid
flowchart TD
  start([Delete employee]) --> reports{Has direct<br/>reports?}
  reports -- no --> del[Delete]
  reports -- yes --> strategy{Strategy}
  strategy -- "promote (default)" --> root{Has a manager?}
  root -- no --> refuse1[422: choose reassign<br/>for a top-level manager]
  root -- yes --> moveUp[Reports move to the<br/>deleted person's manager]
  strategy -- reassign --> nominee{Nominee valid?}
  nominee -- "missing" --> refuse2[400]
  nominee -- "the person, unknown,<br/>or inside their team" --> refuse3[422]
  nominee -- yes --> moveTo[Reports move to the nominee]
  moveUp --> del
  moveTo --> del
  del --> audit[Audit: one REPARENT per report,<br/>one DELETE, all in one transaction]
```

## 8. Avatar resolution

Resolved on the server, so every screen shows the same picture ([ADR-0013](adr/0013-avatar-resolution-chain.md)).

```mermaid
flowchart LR
  e([Employee]) --> up{Uploaded<br/>picture?}
  up -- yes --> s3[/avatars/... via CloudFront/]
  up -- no --> g[Gravatar URL<br/>SHA-256 of the email, d=404]
  g --> found{Gravatar has<br/>a picture?}
  found -- yes --> pic[Gravatar image]
  found -- "no (404)" --> initials[Initials on a<br/>colour picked from the id]
```

## 9. Delivery pipeline

```mermaid
flowchart LR
  dev[Work branch] -- PR --> devb[dev]
  devb -- PR --> main[main]

  subgraph ci[CI, every push and PR]
    checks[Secret scan, format,<br/>lint, typecheck,<br/>unit tests, builds]
    int[Integration tests<br/>real PostgreSQL]
    img[API image<br/>builds and boots]
    e2e[End-to-end tests<br/>full Docker build]
  end

  devb --> ci
  main --> ci
  ci -- "green on main" --> deploy

  subgraph deploy[Deploy workflow, OIDC role]
    build[Build and push image<br/>tagged with the commit]
    tag[Write tag to SSM]
    roll[SSM Run Command:<br/>deploy.sh on the instance]
    webpub[Sync web build to S3,<br/>invalidate CloudFront]
  end

  build --> tag --> roll --> webpub
  roll --> migrate[Container starts:<br/>migrate, then serve]
```

## 10. Test layers

```mermaid
flowchart TB
  unit["Unit — Vitest<br/>shared schemas, API services and helpers,<br/>web components and helpers"]
  int["Integration — Vitest + Supertest + Testcontainers<br/>full HTTP surface on real PostgreSQL:<br/>triggers, constraints, every refusal"]
  e2e["End to end — Playwright<br/>production images in Docker behind a CloudFront stand-in:<br/>every user-facing rule, the security surface"]
  unit --> int --> e2e
```

See [ADR-0020](adr/0020-test-database-triggers-with-testcontainers.md) and [ADR-0035](adr/0035-end-to-end-tests-on-a-full-docker-build.md).

## 11. A login's life

Every employee has one login ([ADR-0036](adr/0036-every-employee-has-a-login-managed-by-admins.md)). The admin moves it between states; the person moves it only by choosing their own password. Every transition is written to `user_audit`.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> OneTimePassword: admin adds the employee
  [*] --> NoPassword: existing employee, at migration
  NoPassword --> OneTimePassword: admin issues a password
  OneTimePassword --> Active: person chooses their own
  Active --> OneTimePassword: admin resets the password
  Active --> Active: person changes their password
  NoPassword --> Deactivated: admin deactivates
  OneTimePassword --> Deactivated: admin deactivates
  Active --> Deactivated: admin deactivates
  Deactivated --> Active: admin reactivates (password unchanged)
  Active --> [*]: employee deleted
  Deactivated --> [*]: employee deleted

  note right of OneTimePassword
    Can only change the password
    or sign out
  end note
  note right of Deactivated
    Signed out at once;
    sign-in refused
  end note
```

Role is separate from these states: an admin can make any login an admin or a regular user, except their own, and never the last active admin.
