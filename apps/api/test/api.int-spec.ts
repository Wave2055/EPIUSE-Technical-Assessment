import {
  insertEmployee,
  insertUser,
  signIn,
  startTestApp,
  type TestApp,
} from './support/test-app.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const newEmployee = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Lindiwe',
  lastName: 'Sithole',
  employeeNumber: 'E-7001',
  email: 'lindiwe.sithole@example.com',
  birthDate: '1992-04-18',
  salary: 810_000,
  position: 'Data Engineer',
  managerId: null,
  ...overrides,
});

describe('HTTP API', () => {
  let t: TestApp;
  let admin: { id: string; token: string };
  let viewerToken: string;

  beforeAll(async () => {
    t = await startTestApp();
    const adminUser = await insertUser(t.prisma, 'ADMIN');
    const viewerUser = await insertUser(t.prisma, 'VIEWER');
    admin = { id: adminUser.id, token: (await signIn(t.http, adminUser.email)).token };
    viewerToken = (await signIn(t.http, viewerUser.email)).token;
  });
  afterAll(() => t?.close());

  describe('errors', () => {
    it('answers 401 with the shared error shape when no token is sent', async () => {
      const res = await t.http.get('/api/employees').expect(401);
      expect(res.body).toEqual({ code: 'UNAUTHENTICATED', message: expect.any(String) });
    });

    it('answers 400 VALIDATION_FAILED with the offending fields', async () => {
      const res = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee({ employeeNumber: 'nope', birthDate: '2999-01-01' }))
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      const paths = res.body.details.issues.map((i: { path: string }) => i.path);
      expect(paths).toEqual(expect.arrayContaining(['employeeNumber', 'birthDate']));
    });

    it('stays healthy', async () => {
      await t.http.get('/api/health').expect(200, { status: 'ok' });
    });
  });

  describe('employees', () => {
    it('creates, reads and audits an employee as the admin who did it', async () => {
      const created = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee())
        .expect(201);
      expect(created.body).toMatchObject({ employeeNumber: 'E-7001', salary: 810_000 });
      expect(created.body.avatarUrl).toMatch(/^https:\/\/gravatar\.com\/avatar\/[0-9a-f]{64}/);

      const audit = await t.http
        .get(`/api/audit?employeeId=${created.body.id}`)
        .set(auth(admin.token))
        .expect(200);
      expect(audit.body.items[0]).toMatchObject({
        action: 'CREATE',
        changedBy: { id: admin.id },
        summary: 'Created with no reporting manager',
      });
    });

    it('answers 409 CONFLICT for a duplicate employee number, naming the field', async () => {
      const res = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send(newEmployee({ email: 'someone.else@example.com' }))
        .expect(409);
      expect(res.body.code).toBe('CONFLICT');
      expect(res.body.message).toContain('employee number');
    });

    it('answers 422 HIERARCHY_CYCLE with the loop when re-parenting into a subtree', async () => {
      const a = await insertEmployee(t.prisma, { firstName: 'Ann', lastName: 'Top' });
      const b = await insertEmployee(t.prisma, {
        firstName: 'Ben',
        lastName: 'Mid',
        managerId: a.id,
      });
      const c = await insertEmployee(t.prisma, {
        firstName: 'Cas',
        lastName: 'Low',
        managerId: b.id,
      });
      const res = await t.http
        .patch(`/api/employees/${a.id}`)
        .set(auth(admin.token))
        .send({ managerId: c.id })
        .expect(422);
      expect(res.body.code).toBe('HIERARCHY_CYCLE');
      expect(res.body.details.path).toEqual(['Ann Top', 'Cas Low', 'Ben Mid', 'Ann Top']);
    });

    it('refuses promote for a top-level manager, then reassigns the team', async () => {
      const boss = await insertEmployee(t.prisma);
      const r1 = await insertEmployee(t.prisma, { managerId: boss.id });
      const r2 = await insertEmployee(t.prisma, { managerId: boss.id });
      const heir = await insertEmployee(t.prisma);

      const refused = await t.http
        .delete(`/api/employees/${boss.id}?strategy=promote`)
        .set(auth(admin.token))
        .expect(422);
      expect(refused.body.code).toBe('ROOT_DELETE_NEEDS_REASSIGN');

      await t.http
        .delete(`/api/employees/${boss.id}?strategy=reassign&reassignTo=${heir.id}`)
        .set(auth(admin.token))
        .expect(204);

      const moved = await t.prisma.employee.findMany({ where: { id: { in: [r1.id, r2.id] } } });
      expect(moved.every((e) => e.managerId === heir.id)).toBe(true);
      const reparents = await t.prisma.employeeAudit.count({
        where: { employeeId: { in: [r1.id, r2.id] }, action: 'REPARENT', changedBy: admin.id },
      });
      expect(reparents).toBe(2);
    });

    it('promotes reports to the grandparent by default', async () => {
      const top = await insertEmployee(t.prisma);
      const mid = await insertEmployee(t.prisma, { managerId: top.id });
      const low = await insertEmployee(t.prisma, { managerId: mid.id });
      await t.http.delete(`/api/employees/${mid.id}`).set(auth(admin.token)).expect(204);
      const after = await t.prisma.employee.findUnique({ where: { id: low.id } });
      expect(after?.managerId).toBe(top.id);
    });

    it('refuses to hand a team to someone inside it', async () => {
      const boss = await insertEmployee(t.prisma);
      const report = await insertEmployee(t.prisma, { managerId: boss.id });
      const res = await t.http
        .delete(`/api/employees/${boss.id}?strategy=reassign&reassignTo=${report.id}`)
        .set(auth(admin.token))
        .expect(422);
      expect(res.body.code).toBe('HIERARCHY_CYCLE');
    });

    it('searches across words and sorts by an allowlisted field', async () => {
      await insertEmployee(t.prisma, { firstName: 'Searchable', lastName: 'Zebra', salary: 1 });
      const res = await t.http
        .get('/api/employees?q=searchable%20zeb&sort=salary:asc')
        .set(auth(admin.token))
        .expect(200);
      expect(res.body.items.map((e: { lastName: string }) => e.lastName)).toEqual(['Zebra']);
    });
  });

  describe('salary masking (ADR-0014)', () => {
    it('never sends a viewer a salary', async () => {
      const list = await t.http
        .get('/api/employees?pageSize=500')
        .set(auth(viewerToken))
        .expect(200);
      expect(list.body.items.length).toBeGreaterThan(0);
      expect(list.body.items.every((e: { salary: unknown }) => e.salary === null)).toBe(true);

      const one = await t.http
        .get(`/api/employees/${list.body.items[0].id}`)
        .set(auth(viewerToken));
      expect(one.body.salary).toBeNull();
    });

    it('refuses a viewer sorting by salary', async () => {
      const res = await t.http
        .get('/api/employees?sort=salary:desc')
        .set(auth(viewerToken))
        .expect(403);
      expect(res.body.code).toBe('SALARY_HIDDEN');
    });

    it('keeps writes and the audit trail admin-only', async () => {
      await t.http.post('/api/employees').set(auth(viewerToken)).send(newEmployee()).expect(403);
      await t.http.get('/api/audit').set(auth(viewerToken)).expect(403);
    });
  });

  describe('sessions', () => {
    it('rotates the refresh cookie and revokes the family when an old one is replayed', async () => {
      const user = await insertUser(t.prisma, 'VIEWER');
      const { cookie } = await signIn(t.http, user.email);

      const rotated = await t.http.post('/api/auth/refresh').set('Cookie', cookie).expect(200);
      expect(rotated.body.accessToken).toEqual(expect.any(String));
      const newCookie = rotated.headers['set-cookie'] as unknown as string[];

      await t.http.post('/api/auth/refresh').set('Cookie', cookie).expect(401);
      await t.http.post('/api/auth/refresh').set('Cookie', newCookie).expect(401);
    });

    it('scopes the refresh cookie to the auth routes and marks it httpOnly', async () => {
      const user = await insertUser(t.prisma, 'VIEWER');
      const { cookie } = await signIn(t.http, user.email);
      expect(cookie[0]).toMatch(/Path=\/api\/auth/);
      expect(cookie[0]).toMatch(/HttpOnly/);
    });
  });

  describe('me and tasks', () => {
    it('shows a linked user their record, manager, team and tasks', async () => {
      const manager = await insertEmployee(t.prisma, { lastName: 'Manager' });
      const lead = await insertEmployee(t.prisma, { lastName: 'Lead', managerId: manager.id });
      const report = await insertEmployee(t.prisma, { lastName: 'Report', managerId: lead.id });
      const user = await insertUser(t.prisma, 'VIEWER', lead.id);
      const { token } = await signIn(t.http, user.email);

      const me = await t.http.get('/api/me').set(auth(token)).expect(200);
      expect(me.body.employee.id).toBe(lead.id);
      expect(me.body.manager.id).toBe(manager.id);
      expect(me.body.directReports.map((e: { id: string }) => e.id)).toEqual([report.id]);

      const created = await t.http
        .post('/api/me/tasks')
        .set(auth(token))
        .send({ title: 'Plan sprint', dueDate: '2026-11-02' })
        .expect(201);
      expect(created.body).toMatchObject({ status: 'todo', dueDate: '2026-11-02' });
      await t.prisma.task.create({ data: { employeeId: report.id, title: 'Report task' } });

      const team = await t.http.get('/api/me/tasks?scope=team').set(auth(token)).expect(200);
      expect(team.body.groups.map((g: { isSelf: boolean }) => g.isSelf)).toEqual([true, false]);
      expect(team.body.groups[1].tasks[0].title).toBe('Report task');

      await t.http
        .patch(`/api/me/tasks/${created.body.id}`)
        .set(auth(token))
        .send({ status: 'done' })
        .expect(200);
    });

    it('lets a manager assign a task to a direct report, and manage it while they report to them', async () => {
      const boss = await insertEmployee(t.prisma, { firstName: 'Busi', lastName: 'Boss' });
      const report = await insertEmployee(t.prisma, { managerId: boss.id });
      const bossToken = (
        await signIn(t.http, (await insertUser(t.prisma, 'VIEWER', boss.id)).email)
      ).token;
      const reportToken = (
        await signIn(t.http, (await insertUser(t.prisma, 'VIEWER', report.id)).email)
      ).token;

      const assigned = await t.http
        .post('/api/me/tasks')
        .set(auth(bossToken))
        .send({ title: 'Draft the Q1 plan', employeeId: report.id })
        .expect(201);
      expect(assigned.body).toMatchObject({
        employeeId: report.id,
        assignedBy: { id: boss.id, firstName: 'Busi', lastName: 'Boss' },
      });

      const own = await t.http.get('/api/me/tasks').set(auth(reportToken)).expect(200);
      expect(own.body.groups[0].tasks[0]).toMatchObject({
        title: 'Draft the Q1 plan',
        assignedBy: { id: boss.id },
      });

      await t.http
        .patch(`/api/me/tasks/${assigned.body.id}`)
        .set(auth(bossToken))
        .send({ dueDate: '2026-12-01' })
        .expect(200);

      // Once the report moves to another manager, the old one loses the task.
      const other = await insertEmployee(t.prisma);
      await t.prisma.employee.update({ where: { id: report.id }, data: { managerId: other.id } });
      await t.http
        .patch(`/api/me/tasks/${assigned.body.id}`)
        .set(auth(bossToken))
        .send({ status: 'done' })
        .expect(404);

      // The owner keeps full control of their own list.
      await t.http.delete(`/api/me/tasks/${assigned.body.id}`).set(auth(reportToken)).expect(204);
    });

    it('refuses to assign a task to anyone but a direct report', async () => {
      const boss = await insertEmployee(t.prisma);
      const report = await insertEmployee(t.prisma, { managerId: boss.id });
      const skipLevel = await insertEmployee(t.prisma, { managerId: report.id });
      const { token } = await signIn(t.http, (await insertUser(t.prisma, 'ADMIN', boss.id)).email);

      for (const target of [skipLevel.id, (await insertEmployee(t.prisma)).id]) {
        const res = await t.http
          .post('/api/me/tasks')
          .set(auth(token))
          .send({ title: 'Not yours to give', employeeId: target })
          .expect(403);
        expect(res.body.code).toBe('FORBIDDEN');
      }
      expect(await t.prisma.task.count({ where: { title: 'Not yours to give' } })).toBe(0);
    });

    it("does not let a report edit a task on their manager's list", async () => {
      const boss = await insertEmployee(t.prisma);
      const report = await insertEmployee(t.prisma, { managerId: boss.id });
      const task = await t.prisma.task.create({
        data: { employeeId: boss.id, title: 'Boss only' },
      });
      const { token } = await signIn(
        t.http,
        (await insertUser(t.prisma, 'VIEWER', report.id)).email,
      );
      await t.http.delete(`/api/me/tasks/${task.id}`).set(auth(token)).expect(404);
    });

    it("hides someone else's task behind a 404", async () => {
      const owner = await insertEmployee(t.prisma);
      const task = await t.prisma.task.create({ data: { employeeId: owner.id, title: 'Private' } });
      const other = await insertEmployee(t.prisma);
      const user = await insertUser(t.prisma, 'ADMIN', other.id);
      const { token } = await signIn(t.http, user.email);
      await t.http
        .patch(`/api/me/tasks/${task.id}`)
        .set(auth(token))
        .send({ status: 'done' })
        .expect(404);
    });

    it('answers 409 NOT_LINKED for a login with no employee record', async () => {
      const res = await t.http.get('/api/me/tasks').set(auth(admin.token)).expect(409);
      expect(res.body.code).toBe('NOT_LINKED');
    });
  });
});
