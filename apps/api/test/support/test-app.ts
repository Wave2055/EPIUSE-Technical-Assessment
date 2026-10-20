import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { hashPassword } from '../../src/auth/password.js';
import { configureApp } from '../../src/configure-app.js';
import type { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const apiRoot = fileURLToPath(new URL('../..', import.meta.url));
export const PASSWORD = 'integration-test-password';

export interface TestApp {
  app: INestApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaService;
  close(): Promise<void>;
}

/**
 * A real PostgreSQL in a container, migrated exactly as production is (ADR-0020), behind
 * the full Nest app with the same global prefix, guards, filter and interceptors.
 *
 * `env` overrides or adds settings, e.g. ORIGIN_SECRET to exercise the origin check.
 */
export async function startTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:17-alpine',
  ).start();
  const url = container.getConnectionUri();

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: url,
    JWT_ACCESS_SECRET: 'integration-test-signing-key-that-is-long-enough',
    COOKIE_SECURE: 'false',
  });
  delete process.env.ORIGIN_SECRET;
  delete process.env.AVATAR_BUCKET;
  delete process.env.API_DOCS;
  Object.assign(process.env, env);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();

  return {
    app,
    http: request(app.getHttpServer()),
    prisma: app.get(PrismaService),
    async close() {
      await app.close();
      await container.stop();
    },
  };
}

let counter = 0;

/** Inserts an employee directly, bypassing the API. */
export async function insertEmployee(
  prisma: PrismaService,
  fields: {
    firstName?: string;
    lastName?: string;
    managerId?: string | null;
    salary?: number;
  } = {},
) {
  counter += 1;
  const lastName = fields.lastName ?? `Person${counter}`;
  return prisma.employee.create({
    data: {
      employeeNumber: `E-${String(1000 + counter)}`,
      firstName: fields.firstName ?? 'Test',
      lastName,
      email: `test.${lastName.toLowerCase()}.${counter}@example.com`,
      birthDate: new Date('1990-01-01T00:00:00Z'),
      salary: fields.salary ?? 500_000,
      position: 'Tester',
      managerId: fields.managerId ?? null,
    },
  });
}

export async function insertUser(
  prisma: PrismaService,
  role: Role,
  employeeId: string | null = null,
) {
  counter += 1;
  return prisma.user.create({
    data: {
      email: `${role.toLowerCase()}${counter}@example.com`,
      passwordHash: await hashPassword(PASSWORD),
      role,
      employeeId,
    },
  });
}

export async function signIn(http: TestApp['http'], email: string) {
  const res = await http.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return {
    token: res.body.accessToken as string,
    cookie: res.headers['set-cookie'] as unknown as string[],
  };
}
