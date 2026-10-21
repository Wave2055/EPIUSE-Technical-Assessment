import { JwtService } from '@nestjs/jwt';
import {
  insertEmployee,
  insertUser,
  signIn,
  startTestApp,
  type TestApp,
} from './support/test-app.js';

/**
 * The paths the main suite does not walk: malformed input, missing and forged credentials,
 * boundary values, and every refusal the API is meant to give. Each answer is checked for
 * the shared error shape as well as its status, because the web client relies on `code`.
 */
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const SECRET = 'integration-test-signing-key-that-is-long-enough';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/** Today as the API sees it: the local date, not UTC, which differs around midnight. */
function localToday() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Numbered in order, not at random: two random numbers can collide, and the duplicate
// would fail with 409. Each spec file has its own database, and nothing else uses E-5xxx.
let sequence = 0;
const newEmployee = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Edge',
  lastName: 'Case',
  employeeNumber: `E-${5000 + ++sequence}`,
  email: `edge.${sequence}@example.com`,
  birthDate: '1990-06-15',
  salary: 500_000,
  position: 'Analyst',
  managerId: null,
  ...overrides,
});

describe('edge cases', () => {
  let t: TestApp;
  let admin: { id: string; email: string; token: string };
  let viewerToken: string;

  beforeAll(async () => {
    t = await startTestApp();
    const adminUser = await insertUser(t.prisma, 'ADMIN');
    admin = { ...adminUser, token: (await signIn(t.http, adminUser.email)).token };
    viewerToken = (await signIn(t.http, (await insertUser(t.prisma, 'VIEWER')).email)).token;
  });
  afterAll(() => t?.close());

  describe('request parsing', () => {
    it('answers malformed JSON with 400 and the shared shape, not a 500', async () => {
      const res = await t.http
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "a@example.com", "password": ')
        .expect(400);
      expect(res.body).toEqual({ code: 'VALIDATION_FAILED', message: expect.any(String) });
    });

    it('refuses an oversized body with 413', async () => {
      const res = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee({ position: 'x'.repeat(200_000) }))
        .expect(413);
      expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('answers an unknown route with 404 in the shared shape', async () => {
      const res = await t.http.get('/api/nope').set(auth(admin.token)).expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('sends hardening headers and no framework fingerprint', async () => {
      const res = await t.http.get('/api/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('authentication', () => {
    const tokenFor = (payload: object, secret = SECRET) =>
      new JwtService().sign(payload, { secret, algorithm: 'HS256' });

    it('rejects a malformed login body before checking credentials', async () => {
      const res = await t.http
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: '' })
        .expect(400);
      const paths = res.body.details.issues.map((i: { path: string }) => i.path);
      expect(paths).toEqual(expect.arrayContaining(['email', 'password']));
    });

    it('sets no cookie when the password is wrong', async () => {
      const res = await t.http
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'definitely-wrong' })
        .expect(401);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('accepts the email in any case and with surrounding spaces', async () => {
      await t.http
        .post('/api/auth/login')
        .send({ email: `  ${admin.email.toUpperCase()} `, password: 'integration-test-password' })
        .expect(200);
    });

    it.each([
      ['no header', undefined],
      ['another scheme', 'Basic YWRtaW46cGFzcw=='],
      ['an empty bearer', 'Bearer '],
      ['garbage', 'Bearer not.a.jwt'],
    ])('answers 401 for %s', async (_label, header) => {
      const req = t.http.get('/api/employees');
      if (header !== undefined) req.set('Authorization', header);
      const res = await req.expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('rejects a token signed with another key', async () => {
      const forged = tokenFor(
        { sub: admin.id, email: admin.email, role: 'ADMIN' },
        'some-other-signing-key-that-is-also-long-enough',
      );
      await t.http.get('/api/employees').set(auth(forged)).expect(401);
    });

    it('rejects an expired token', async () => {
      const expired = tokenFor({
        sub: admin.id,
        email: admin.email,
        role: 'ADMIN',
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      await t.http.get('/api/employees').set(auth(expired)).expect(401);
    });

    it('rejects an unsigned (alg: none) token', async () => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: admin.id, email: admin.email, role: 'ADMIN' })}.`;
      await t.http.get('/api/employees').set(auth(unsigned)).expect(401);
    });

    it('ignores the role a token claims, using the one on the login (ADR-0036)', async () => {
      const viewer = await insertUser(t.prisma, 'VIEWER');
      const token = tokenFor({ sub: viewer.id, email: viewer.email, role: 'ADMIN' });
      await t.http.get('/api/employees').set(auth(token)).expect(200);
      await t.http.get('/api/audit').set(auth(token)).expect(403);
    });

    it("rejects a validly signed token for a login that doesn't exist", async () => {
      const token = tokenFor({ sub: UNKNOWN_ID, email: 'ghost@example.com', role: 'ADMIN' });
      await t.http.get('/api/employees').set(auth(token)).expect(401);
    });

    it('rejects a tampered payload', async () => {
      const [header, , signature] = admin.token.split('.');
      const payload = Buffer.from(
        JSON.stringify({ sub: admin.id, email: admin.email, role: 'ADMIN', exp: 9_999_999_999 }),
      ).toString('base64url');
      await t.http
        .get('/api/employees')
        .set(auth(`${header}.${payload}.${signature}`))
        .expect(401);
    });

    it('answers refresh without a cookie with 401', async () => {
      const res = await t.http.post('/api/auth/refresh').expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('ends the session on logout, so the cookie no longer refreshes', async () => {
      const user = await insertUser(t.prisma, 'VIEWER');
      const { cookie } = await signIn(t.http, user.email);
      const out = await t.http.post('/api/auth/logout').set('Cookie', cookie).expect(204);
      expect(String(out.headers['set-cookie'])).toMatch(/Expires=Thu, 01 Jan 1970/);
      await t.http.post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('lets logout succeed without a session', async () => {
      await t.http.post('/api/auth/logout').expect(204);
    });
  });

  describe('employee validation', () => {
    it.each([
      ['a birth date of today', { birthDate: localToday() }, 'birthDate'],
      ['a birth date before 1900', { birthDate: '1899-12-31' }, 'birthDate'],
      ['an impossible date', { birthDate: '1990-02-30' }, 'birthDate'],
      ['a negative salary', { salary: -1 }, 'salary'],
      ['a salary over the cap', { salary: 1_000_000_001 }, 'salary'],
      ['a salary sent as text', { salary: '500000' }, 'salary'],
      ['a blank first name', { firstName: '   ' }, 'firstName'],
      ['a first name over 100 characters', { firstName: 'a'.repeat(101) }, 'firstName'],
      ['a lower-case employee number', { employeeNumber: 'e-1234' }, 'employeeNumber'],
      ['an invalid email', { email: 'nobody@' }, 'email'],
      ['a manager id that is not a uuid', { managerId: 'boss' }, 'managerId'],
    ])('refuses %s', async (_label, override, field) => {
      const res = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee(override))
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.details.issues.map((i: { path: string }) => i.path)).toContain(field);
    });

    it('accepts boundary values: a zero salary and a birth date of 1900-01-01', async () => {
      await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee({ salary: 0, birthDate: '1900-01-01' }))
        .expect(201);
    });

    it('stores names with accents, apostrophes and hyphens exactly', async () => {
      const res = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee({ firstName: 'Zoë', lastName: "O'Brien-Nkosi" }))
        .expect(201);
      const read = await t.http
        .get(`/api/employees/${res.body.employee.id}`)
        .set(auth(admin.token));
      expect(read.body).toMatchObject({ firstName: 'Zoë', lastName: "O'Brien-Nkosi" });
    });

    it('normalises the email and treats a different case as a duplicate', async () => {
      const created = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee({ email: '  Mixed.Case@Example.COM ' }))
        .expect(201);
      expect(created.body.employee.email).toBe('mixed.case@example.com');
      expect(created.body.login.email).toBe('mixed.case@example.com');

      const dup = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee({ email: 'MIXED.CASE@example.com' }))
        .expect(409);
      expect(dup.body.details.fields).toEqual(['email address']);
    });

    it('ignores fields the schema does not know, such as an id or avatar key', async () => {
      const res = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee({ id: UNKNOWN_ID, avatarKey: 'avatars/x.png' }))
        .expect(201);
      expect(res.body.employee.id).not.toBe(UNKNOWN_ID);
      expect(res.body.employee.hasUploadedAvatar).toBe(false);
    });

    it('refuses a manager who does not exist, on create and on update', async () => {
      const create = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee({ managerId: UNKNOWN_ID }))
        .expect(422);
      expect(create.body.code).toBe('UNKNOWN_MANAGER');

      const person = await insertEmployee(t.prisma);
      const update = await t.http
        .patch(`/api/employees/${person.id}`)
        .set(auth(admin.token))
        .send({ managerId: UNKNOWN_ID })
        .expect(422);
      expect(update.body.code).toBe('UNKNOWN_MANAGER');
    });

    it('refuses to make someone their own manager, naming the loop', async () => {
      const person = await insertEmployee(t.prisma, { firstName: 'Self' });
      const res = await t.http
        .patch(`/api/employees/${person.id}`)
        .set(auth(admin.token))
        .send({ managerId: person.id })
        .expect(422);
      expect(res.body.code).toBe('HIERARCHY_CYCLE');
    });

    it('lets an employee be moved to the top, with no manager', async () => {
      const boss = await insertEmployee(t.prisma);
      const report = await insertEmployee(t.prisma, { managerId: boss.id });
      const res = await t.http
        .patch(`/api/employees/${report.id}`)
        .set(auth(admin.token))
        .send({ managerId: null })
        .expect(200);
      expect(res.body.managerId).toBeNull();
    });

    it('refuses an update with nothing to change', async () => {
      const person = await insertEmployee(t.prisma);
      await t.http.patch(`/api/employees/${person.id}`).set(auth(admin.token)).send({}).expect(400);
    });

    it('treats a patch that repeats the current manager as a no-op, not a loop check', async () => {
      const boss = await insertEmployee(t.prisma);
      const report = await insertEmployee(t.prisma, { managerId: boss.id });
      await t.http
        .patch(`/api/employees/${report.id}`)
        .set(auth(admin.token))
        .send({ managerId: boss.id })
        .expect(200);
    });
  });

  describe('employee lookups and deletion', () => {
    it('answers 400 for an id that is not a uuid, and 404 for an unknown one', async () => {
      await t.http.get('/api/employees/123').set(auth(admin.token)).expect(400);
      const res = await t.http
        .get(`/api/employees/${UNKNOWN_ID}`)
        .set(auth(admin.token))
        .expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('deletes someone with no reports whatever the strategy, then 404s on a repeat', async () => {
      const leaf = await insertEmployee(t.prisma);
      await t.http.delete(`/api/employees/${leaf.id}`).set(auth(admin.token)).expect(204);
      await t.http.get(`/api/employees/${leaf.id}`).set(auth(admin.token)).expect(404);
      await t.http.delete(`/api/employees/${leaf.id}`).set(auth(admin.token)).expect(404);
    });

    it('refuses an unknown strategy', async () => {
      const leaf = await insertEmployee(t.prisma);
      await t.http
        .delete(`/api/employees/${leaf.id}?strategy=fire-everyone`)
        .set(auth(admin.token))
        .expect(400);
      expect(await t.prisma.employee.count({ where: { id: leaf.id } })).toBe(1);
    });

    it('refuses to reassign a team to the person being deleted or to nobody', async () => {
      const boss = await insertEmployee(t.prisma);
      const manager = await insertEmployee(t.prisma, { managerId: boss.id });
      await insertEmployee(t.prisma, { managerId: manager.id });

      await t.http
        .delete(`/api/employees/${manager.id}?strategy=reassign&reassignTo=${manager.id}`)
        .set(auth(admin.token))
        .expect(422);
      await t.http
        .delete(`/api/employees/${manager.id}?strategy=reassign&reassignTo=${UNKNOWN_ID}`)
        .set(auth(admin.token))
        .expect(422);
      await t.http
        .delete(`/api/employees/${manager.id}?strategy=reassign`)
        .set(auth(admin.token))
        .expect(400);
      expect(await t.prisma.employee.count({ where: { id: manager.id } })).toBe(1);
    });

    it('keeps the whole delete atomic: a refused reassignment moves nobody', async () => {
      const boss = await insertEmployee(t.prisma);
      const manager = await insertEmployee(t.prisma, { managerId: boss.id });
      const report = await insertEmployee(t.prisma, { managerId: manager.id });
      const grandReport = await insertEmployee(t.prisma, { managerId: report.id });

      await t.http
        .delete(`/api/employees/${manager.id}?strategy=reassign&reassignTo=${grandReport.id}`)
        .set(auth(admin.token))
        .expect(422);
      const after = await t.prisma.employee.findUnique({ where: { id: report.id } });
      expect(after?.managerId).toBe(manager.id);
    });
  });

  describe('listing', () => {
    it.each([
      ['page 0', 'page=0'],
      ['a page size over 500', 'pageSize=501'],
      ['a fractional page', 'page=1.5'],
      ['an unlisted sort field', 'sort=passwordHash:asc'],
      ['a sort with no direction', 'sort=name'],
      ['a malformed manager filter', 'managerId=boss'],
      ['a malformed date filter', 'birthDateFrom=yesterday'],
      ['a search over 100 characters', `q=${'a'.repeat(101)}`],
    ])('refuses %s', async (_label, query) => {
      const res = await t.http.get(`/api/employees?${query}`).set(auth(admin.token)).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('treats search text as data, not as SQL or a pattern', async () => {
      for (const q of ["' OR 1=1 --", '%', '_', '\\']) {
        const res = await t.http
          .get(`/api/employees?q=${encodeURIComponent(q)}`)
          .set(auth(admin.token))
          .expect(200);
        expect(res.body.total).toBe(0);
      }
    });

    it('returns an empty page past the end, with the true total', async () => {
      const res = await t.http
        .get('/api/employees?page=999&pageSize=10')
        .set(auth(admin.token))
        .expect(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('filters to people with no manager', async () => {
      const res = await t.http
        .get('/api/employees?managerId=none&pageSize=500')
        .set(auth(admin.token))
        .expect(200);
      expect(res.body.items.every((e: { managerId: null }) => e.managerId === null)).toBe(true);
    });

    it('refuses a viewer filtering by salary as well as sorting by it', async () => {
      const res = await t.http
        .get('/api/employees?salaryMin=1000000')
        .set(auth(viewerToken))
        .expect(403);
      expect(res.body.code).toBe('SALARY_HIDDEN');
    });

    it('serves the org chart nodes to any signed-in user, with no salaries', async () => {
      const res = await t.http.get('/api/hierarchy').set(auth(viewerToken)).expect(200);
      expect(JSON.stringify(res.body)).not.toContain('salary');
    });
  });

  describe('audit trail', () => {
    it('filters by action and by employee', async () => {
      const person = await insertEmployee(t.prisma);
      await t.http
        .patch(`/api/employees/${person.id}`)
        .set(auth(admin.token))
        .send({ position: 'Audited' })
        .expect(200);

      const updates = await t.http
        .get(`/api/audit?action=UPDATE&employeeId=${person.id}`)
        .set(auth(admin.token))
        .expect(200);
      expect(updates.body.items).toHaveLength(1);
      expect(updates.body.items[0]).toMatchObject({
        action: 'UPDATE',
        changedBy: { id: admin.id },
        changes: [{ field: 'position', to: 'Audited' }],
      });
    });

    it('refuses an unknown action filter, and refuses viewers outright', async () => {
      await t.http.get('/api/audit?action=DROP').set(auth(admin.token)).expect(400);
      await t.http.get('/api/audit').set(auth(viewerToken)).expect(403);
    });
  });

  describe('me and tasks', () => {
    it('shows every login its own employee record', async () => {
      const res = await t.http.get('/api/me').set(auth(admin.token)).expect(200);
      const login = await t.prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
      expect(res.body.employee.id).toBe(login.employeeId);
      expect(res.body.user.mustChangePassword).toBe(false);
    });

    it('validates task input', async () => {
      const person = await insertEmployee(t.prisma);
      const { token } = await signIn(
        t.http,
        (await insertUser(t.prisma, 'VIEWER', person.id)).email,
      );
      for (const body of [
        { title: '   ' },
        { title: 'x'.repeat(201) },
        { title: 'Valid', dueDate: '2026-02-30' },
        { title: 'Valid', status: 'blocked' },
        { title: 'Valid', employeeId: 'someone' },
      ]) {
        await t.http.post('/api/me/tasks').set(auth(token)).send(body).expect(400);
      }
      await t.http.get('/api/me/tasks?scope=everyone').set(auth(token)).expect(400);
      await t.http.patch('/api/me/tasks/not-a-uuid').set(auth(token)).send({}).expect(400);

      const task = await t.http
        .post('/api/me/tasks')
        .set(auth(token))
        .send({ title: 'Real' })
        .expect(201);
      await t.http.patch(`/api/me/tasks/${task.body.id}`).set(auth(token)).send({}).expect(400);
      await t.http.delete(`/api/me/tasks/${task.body.id}`).set(auth(token)).expect(204);
      await t.http.delete(`/api/me/tasks/${task.body.id}`).set(auth(token)).expect(404);
    });

    it('shows a person with no reports only their own list in the team view', async () => {
      const person = await insertEmployee(t.prisma);
      const { token } = await signIn(
        t.http,
        (await insertUser(t.prisma, 'VIEWER', person.id)).email,
      );
      const res = await t.http.get('/api/me/tasks?scope=team').set(auth(token)).expect(200);
      expect(res.body.groups).toHaveLength(1);
      expect(res.body.groups[0].isSelf).toBe(true);
    });

    it("drops a person's tasks when they are deleted, and keeps tasks they assigned", async () => {
      const boss = await insertEmployee(t.prisma);
      const report = await insertEmployee(t.prisma, { managerId: boss.id });
      const own = await t.prisma.task.create({ data: { employeeId: boss.id, title: 'Own' } });
      const given = await t.prisma.task.create({
        data: { employeeId: report.id, assignedById: boss.id, title: 'Given' },
      });

      await t.http
        .delete(
          `/api/employees/${boss.id}?strategy=reassign&reassignTo=${(await insertEmployee(t.prisma)).id}`,
        )
        .set(auth(admin.token))
        .expect(204);

      expect(await t.prisma.task.findUnique({ where: { id: own.id } })).toBeNull();
      expect(await t.prisma.task.findUnique({ where: { id: given.id } })).toMatchObject({
        assignedById: null,
      });
    });
  });

  describe('avatars', () => {
    it('explains that uploads are off when no bucket is configured', async () => {
      const person = await insertEmployee(t.prisma);
      const res = await t.http
        .post(`/api/employees/${person.id}/avatar/upload-url`)
        .set(auth(admin.token))
        .send({ contentType: 'image/png' })
        .expect(503);
      expect(res.body.code).toBe('AVATAR_UPLOADS_DISABLED');
    });

    it('keeps avatar changes admin-only and refuses other file types', async () => {
      const person = await insertEmployee(t.prisma);
      await t.http
        .post(`/api/employees/${person.id}/avatar/upload-url`)
        .set(auth(viewerToken))
        .send({ contentType: 'image/png' })
        .expect(403);
      await t.http
        .post(`/api/employees/${person.id}/avatar/upload-url`)
        .set(auth(admin.token))
        .send({ contentType: 'image/svg+xml' })
        .expect(400);
    });
  });
});

describe('behind CloudFront (origin secret on)', () => {
  let t: TestApp;
  const SECRET_HEADER = 'x-origin-secret';
  const ORIGIN_SECRET = 'integration-origin-secret';

  beforeAll(async () => {
    t = await startTestApp({ ORIGIN_SECRET, API_DOCS: 'false' });
  });
  afterAll(() => t?.close());

  it('refuses requests that did not come through the distribution', async () => {
    const missing = await t.http.get('/api/employees').expect(403);
    expect(missing.body.code).toBe('FORBIDDEN');
    await t.http.get('/api/employees').set(SECRET_HEADER, 'wrong').expect(403);
    await t.http.post('/api/auth/login').send({}).expect(403);
  });

  it('lets them through to authentication when the secret is right', async () => {
    await t.http.get('/api/employees').set(SECRET_HEADER, ORIGIN_SECRET).expect(401);
  });

  it('exempts the health check, which the container polls directly', async () => {
    await t.http.get('/api/health').expect(200);
  });

  it('does not serve the API docs when API_DOCS is off', async () => {
    await t.http.get('/api/docs').set(SECRET_HEADER, ORIGIN_SECRET).expect(404);
    await t.http.get('/api/docs-json').set(SECRET_HEADER, ORIGIN_SECRET).expect(404);
  });
});
