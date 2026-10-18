# Employee Hierarchy

A cloud-hosted application for managing EPI-USE Africa's employee hierarchy, built for the EPI-USE Technical Services assessment ([brief](docs/Technical%20Services%20-%20Assessment%20v2.1.pdf)).

| Document                                            | For                                                   |
| --------------------------------------------------- | ----------------------------------------------------- |
| [User guide](docs/user-guide.md)                    | People using the application                          |
| [Technical document](docs/technical-document.md)    | Architecture, design patterns, technologies and why   |
| [Architecture decision records](docs/adr/README.md) | Each decision in full, with the alternatives rejected |

## Stack

| Part              | Technology                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `apps/web`        | React 19, Vite, TanStack Query and Table, React Flow with d3-hierarchy, Tailwind and shadcn/ui |
| `apps/api`        | NestJS 12, Prisma 7 with the `pg` driver adapter, argon2id and JWT, Swagger                    |
| `packages/shared` | zod schemas and the types inferred from them, used by both apps                                |
| Database          | PostgreSQL 17, with triggers for cycle prevention and the audit trail                          |
| Tooling           | pnpm workspaces, TypeScript, ESLint, Prettier, Vitest, Testcontainers, Playwright, secretlint  |

## Running it locally

You need Node.js 22 or later (see `.nvmrc`), pnpm 10, and Docker.

1. **Install dependencies.** This also generates the Prisma client and turns on the secret-scanning pre-commit hook.

   ```sh
   pnpm install
   ```

2. **Start PostgreSQL.**

   ```sh
   docker compose up -d
   ```

3. **Configure the API.** Copy the template and fill it in:

   ```sh
   cp apps/api/.env.example apps/api/.env
   ```

   | Variable                                      | Value                                                                                                                        |
   | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`                                | A PostgreSQL connection URL. For the compose database the user, password and database are all `epiuse`, on `localhost:5432`. |
   | `JWT_ACCESS_SECRET`                           | At least 32 random characters, e.g. `openssl rand -base64 48`                                                                |
   | `SEED_ADMIN_PASSWORD`, `SEED_VIEWER_PASSWORD` | Passwords for the two starter logins, 12 or more characters each                                                             |

   Leave `COOKIE_SECURE=false` locally, because the dev servers use plain HTTP. Leave `AVATAR_BUCKET` empty unless you have an S3 bucket for avatar uploads; Gravatar works without it. `.env` is gitignored and must never be committed.

4. **Create the schema and load the starter data.**

   ```sh
   pnpm --filter @epiuse/api db:deploy
   pnpm --filter @epiuse/api db:seed
   ```

   The seed creates 15 employees, the logins `admin@example.com` (administrator) and `viewer@example.com` (viewer) with your seed passwords, and some home-screen tasks. It does nothing if employees already exist.

5. **Run everything.**

   ```sh
   pnpm dev
   ```

   This watches the shared package and starts the API on port 3000 and the web app on port 5173. Open http://localhost:5173 and sign in. The API documentation is at http://localhost:3000/api/docs.

## Scripts

Run from the repository root:

| Command                 | Does                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`              | Shared package in watch mode, API and web app with reload                 |
| `pnpm build`            | Builds the shared package, then both apps                                 |
| `pnpm lint`             | ESLint in every package                                                   |
| `pnpm typecheck`        | TypeScript in every package                                               |
| `pnpm format:check`     | Prettier check; `pnpm format` rewrites files                              |
| `pnpm test:unit`        | Unit tests in every package                                               |
| `pnpm test:integration` | API integration tests against PostgreSQL in Testcontainers (needs Docker) |
| `pnpm test:e2e`         | Playwright end-to-end test (currently skipped)                            |
| `pnpm scan:secrets`     | secretlint over the whole repository                                      |

Database commands run in the API package, e.g. `pnpm --filter @epiuse/api db:migrate`:

| Command      | Does                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `db:migrate` | Creates a migration from schema changes and applies it (development)                                             |
| `db:deploy`  | Applies pending migrations, as production does                                                                   |
| `db:seed`    | Loads the starter data into an empty database                                                                    |
| `db:reset`   | Drops the database and re-applies every migration. Destroys all data; run `db:seed` afterwards for starter data. |

The API's types and error codes come from `packages/shared`, which the apps use from its build output. If the editor reports missing types after you change a schema, run `pnpm --filter @epiuse/shared build`, or keep `pnpm dev` running.

## Repository layout

```
apps/
  api/
    prisma/             schema, migrations (with hand-written triggers), seed
    src/
      common/           guards, validation pipe, error filter, salary masking, decorators
      auth/ me/ tasks/  sign-in and refresh, the signed-in person, home-screen tasks
      employees/        CRUD, the list query, delete strategies, avatars on records
      hierarchy/ audit/ avatars/ config/ prisma/ health/
    test/               integration tests (Testcontainers)
  web/
    src/
      features/         auth, employees, hierarchy, home, audit: hooks and components
      routes/           one file per page
      components/ui/    shadcn/ui components
packages/shared/        zod schemas shared by API and web
docs/                   user guide, technical document, ADRs, the brief
```

## API

Every route is under `/api`. Errors always have the body `{ code, message, details? }`.

| Area      | Routes                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Auth      | `POST /auth/login`, `/auth/refresh`, `/auth/logout`. The refresh token is an httpOnly cookie on `/api/auth`.                    |
| Employees | `GET /employees` (search, sort, filter, page), `GET`, `PATCH`, `DELETE /employees/:id`, `POST /employees`; avatar upload routes |
| Hierarchy | `GET /hierarchy`: every employee as an org chart node                                                                           |
| Me        | `GET /me`; `GET`, `POST /me/tasks`; `PATCH`, `DELETE /me/tasks/:id`                                                             |
| Audit     | `GET /audit` (administrators only)                                                                                              |
| Health    | `GET /health`                                                                                                                   |

Writes and the audit trail need the `ADMIN` role. For a `VIEWER`, every salary in every response is `null`. Full request and response schemas are in Swagger at `/api/docs`.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and every pull request. It scans for secrets, then checks formatting, lint, type checks, unit tests and the build. A separate job runs the integration tests against PostgreSQL. Deployment to AWS is designed ([ADR-0015](docs/adr/0015-ec2-docker-for-api-compute.md) to [ADR-0019](docs/adr/0019-github-actions-oidc-cicd.md)) but not built yet.

## Status

Working end to end locally: sign-in with administrator and viewer roles, the home screen with tasks, the org chart, the employee table, adding, editing and deleting with loop prevention and team moves, and the audit trail.

Still to do: the AWS infrastructure and deploy workflow, the avatar upload screen, drag-to-re-parent and collapse in the org chart, CSV import, and enabling the end-to-end test. See [ADR-0023](docs/adr/0023-record-implementation-deviations.md).
