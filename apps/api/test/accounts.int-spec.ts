import {
  PASSWORD,
  insertEmployee,
  insertUser,
  signIn,
  startTestApp,
  type TestApp,
} from './support/test-app.js';

/**
 * Accounts (ADR-0036): every employee has a login, created with them; admins issue one-time
 * passwords, promote, demote and deactivate; everyone can change their own password. The
 * guard reads the login on every request, so access changes take effect immediately.
 */
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const newEmployee = (n: string) => ({
  firstName: 'New',
  lastName: `Starter${n}`,
  employeeNumber: `E-${n}`,
  email: `new.starter.${n}@example.com`,
  birthDate: '1995-02-03',
  salary: 400_000,
  position: 'Analyst',
  managerId: null,
});

describe('accounts', () => {
  let t: TestApp;
  let admin: { id: string; token: string };

  beforeAll(async () => {
    t = await startTestApp({}, { unthrottled: true });
    const user = await insertUser(t.prisma, 'ADMIN');
    admin = { id: user.id, token: (await signIn(t.http, user.email)).token };
  });
  afterAll(() => t?.close());

  /** Adds an employee through the API and signs in with the one-time password it returns. */
  async function hire(n: string) {
    const res = await t.http
      .post('/api/employees')
      .set(auth(admin.token))
      .send(newEmployee(n))
      .expect(201);
    const { email, temporaryPassword } = res.body.login as {
      email: string;
      temporaryPassword: string;
    };
    const login = await t.http
      .post('/api/auth/login')
      .send({ email, password: temporaryPassword })
      .expect(200);
    const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
    return {
      employeeId: res.body.employee.id as string,
      userId: user.id,
      email,
      temporaryPassword,
      token: login.body.accessToken as string,
      cookie: login.headers['set-cookie'] as unknown as string[],
      mustChange: login.body.user.mustChangePassword as boolean,
    };
  }

  describe('creating an employee', () => {
    it('creates their login too, returning a one-time password that signs in', async () => {
      const person = await hire('6001');
      expect(person.email).toBe('new.starter.6001@example.com');
      expect(person.temporaryPassword).toMatch(/^[A-Za-z2-9]{16}$/);
      expect(person.mustChange).toBe(true);

      const stored = await t.prisma.user.findUniqueOrThrow({ where: { id: person.userId } });
      expect(stored).toMatchObject({ role: 'VIEWER', employeeId: person.employeeId });
      expect(stored.passwordHash).not.toContain(person.temporaryPassword);
    });

    it('never shows the password again', async () => {
      const person = await hire('6002');
      const list = await t.http.get('/api/users').set(auth(admin.token)).expect(200);
      expect(JSON.stringify(list.body)).not.toContain(person.temporaryPassword);
      const employee = await t.http
        .get(`/api/employees/${person.employeeId}`)
        .set(auth(admin.token))
        .expect(200);
      expect(JSON.stringify(employee.body)).not.toContain(person.temporaryPassword);
    });

    it('creates neither the employee nor the login when the email belongs to another login', async () => {
      const taken = await insertUser(t.prisma, 'VIEWER');
      const res = await t.http
        .post('/api/employees')
        .set(auth(admin.token))
        .send({ ...newEmployee('6003'), email: taken.email })
        .expect(409);
      expect(res.body.details.fields).toEqual(['email address']);
      expect(await t.prisma.employee.count({ where: { employeeNumber: 'E-6003' } })).toBe(0);
    });
  });

  describe('the one-time password', () => {
    it('allows only changing it, reading who you are, and signing out, until it is changed', async () => {
      const person = await hire('6010');
      const blocked = await t.http.get('/api/employees').set(auth(person.token)).expect(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      await t.http.get('/api/me/tasks').set(auth(person.token)).expect(403);
      const me = await t.http.get('/api/me').set(auth(person.token)).expect(200);
      expect(me.body.user.mustChangePassword).toBe(true);

      const changed = await t.http
        .post('/api/auth/password')
        .set(auth(person.token))
        .send({ currentPassword: person.temporaryPassword, newPassword: 'my own long password' })
        .expect(200);
      expect(changed.body.user.mustChangePassword).toBe(false);
      expect(changed.headers['set-cookie']).toBeDefined();

      await t.http.get('/api/employees').set(auth(changed.body.accessToken)).expect(200);
      await t.http
        .post('/api/auth/login')
        .send({ email: person.email, password: person.temporaryPassword })
        .expect(401);
      await t.http
        .post('/api/auth/login')
        .send({ email: person.email, password: 'my own long password' })
        .expect(200);
    });

    it('ends every other session when the password changes', async () => {
      const person = await hire('6011');
      await t.http
        .post('/api/auth/password')
        .set(auth(person.token))
        .send({ currentPassword: person.temporaryPassword, newPassword: 'another long password' })
        .expect(200);
      await t.http.post('/api/auth/refresh').set('Cookie', person.cookie).expect(401);
    });

    it('refuses a wrong current password, a short new one, and an unchanged one', async () => {
      const person = await hire('6012');
      const wrong = await t.http
        .post('/api/auth/password')
        .set(auth(person.token))
        .send({ currentPassword: 'not it at all', newPassword: 'a perfectly long one' })
        .expect(400);
      expect(wrong.body.details.issues[0].path).toBe('currentPassword');
      await t.http
        .post('/api/auth/password')
        .set(auth(person.token))
        .send({ currentPassword: person.temporaryPassword, newPassword: 'short' })
        .expect(400);
      await t.http
        .post('/api/auth/password')
        .set(auth(person.token))
        .send({ currentPassword: person.temporaryPassword, newPassword: person.temporaryPassword })
        .expect(400);
      await t.http.post('/api/auth/password').send({}).expect(401);
    });
  });

  describe('managing users', () => {
    it('lists every login with its employee and status, for admins only', async () => {
      const person = await hire('6020');
      const res = await t.http.get('/api/users').set(auth(admin.token)).expect(200);
      const row = res.body.users.find((u: { id: string }) => u.id === person.userId);
      expect(row).toMatchObject({
        email: person.email,
        role: 'VIEWER',
        status: 'must_change_password',
        employee: { employeeNumber: 'E-6020', firstName: 'New' },
      });
      expect(row.lastLoginAt).not.toBeNull();
      expect(JSON.stringify(res.body)).not.toMatch(/password_?hash/i);

      const viewer = await signIn(t.http, (await insertUser(t.prisma, 'VIEWER')).email);
      await t.http.get('/api/users').set(auth(viewer.token)).expect(403);
      await t.http
        .patch(`/api/users/${person.userId}`)
        .set(auth(viewer.token))
        .send({ role: 'ADMIN' })
        .expect(403);
      await t.http
        .post(`/api/users/${person.userId}/reset-password`)
        .set(auth(viewer.token))
        .expect(403);
    });

    it('promotion takes effect on the very next request, with the same token', async () => {
      const user = await insertUser(t.prisma, 'VIEWER');
      const { token } = await signIn(t.http, user.email);
      await t.http.get('/api/audit').set(auth(token)).expect(403);

      await t.http
        .patch(`/api/users/${user.id}`)
        .set(auth(admin.token))
        .send({ role: 'ADMIN' })
        .expect(200);
      await t.http.get('/api/audit').set(auth(token)).expect(200);
    });

    it('demotion takes effect at once and ends their sessions', async () => {
      const user = await insertUser(t.prisma, 'ADMIN');
      const { token, cookie } = await signIn(t.http, user.email);
      await t.http
        .patch(`/api/users/${user.id}`)
        .set(auth(admin.token))
        .send({ role: 'VIEWER' })
        .expect(200);
      await t.http.get('/api/audit').set(auth(token)).expect(403);
      await t.http.post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('deactivation blocks sign-in and every token at once; reactivation restores sign-in', async () => {
      const user = await insertUser(t.prisma, 'VIEWER');
      const { token } = await signIn(t.http, user.email);
      const res = await t.http
        .patch(`/api/users/${user.id}`)
        .set(auth(admin.token))
        .send({ active: false })
        .expect(200);
      expect(res.body.status).toBe('deactivated');

      await t.http.get('/api/employees').set(auth(token)).expect(401);
      const login = await t.http
        .post('/api/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(401);
      expect(login.body.message).toBe('That email and password do not match an account.');

      await t.http
        .patch(`/api/users/${user.id}`)
        .set(auth(admin.token))
        .send({ active: true })
        .expect(200);
      await t.http
        .post('/api/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
    });

    it('resets a password: the old one and every session stop working', async () => {
      const user = await insertUser(t.prisma, 'VIEWER');
      const { cookie } = await signIn(t.http, user.email);
      const res = await t.http
        .post(`/api/users/${user.id}/reset-password`)
        .set(auth(admin.token))
        .expect(200);
      expect(res.body.email).toBe(user.email);

      await t.http.post('/api/auth/refresh').set('Cookie', cookie).expect(401);
      await t.http
        .post('/api/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(401);
      const login = await t.http
        .post('/api/auth/login')
        .send({ email: user.email, password: res.body.temporaryPassword })
        .expect(200);
      expect(login.body.user.mustChangePassword).toBe(true);
    });

    it('lets a login with no password sign in only once one is issued', async () => {
      const employee = await insertEmployee(t.prisma);
      const user = await t.prisma.user.create({
        data: {
          email: `nopassword.${employee.id.slice(0, 8)}@example.com`,
          passwordHash: null,
          role: 'VIEWER',
          employeeId: employee.id,
          mustChangePassword: true,
        },
      });
      await t.http.post('/api/auth/login').send({ email: user.email, password: '' }).expect(400);
      await t.http
        .post('/api/auth/login')
        .send({ email: user.email, password: 'anything at all' })
        .expect(401);

      const list = await t.http.get('/api/users').set(auth(admin.token)).expect(200);
      expect(list.body.users.find((u: { id: string }) => u.id === user.id).status).toBe(
        'no_password',
      );
    });

    it('refuses an admin changing their own account', async () => {
      for (const body of [{ role: 'VIEWER' }, { active: false }]) {
        const res = await t.http
          .patch(`/api/users/${admin.id}`)
          .set(auth(admin.token))
          .send(body)
          .expect(409);
        expect(res.body.code).toBe('CANNOT_CHANGE_SELF');
      }
      await t.http.post(`/api/users/${admin.id}/reset-password`).set(auth(admin.token)).expect(409);
    });

    it('validates the request and the id', async () => {
      const user = await insertUser(t.prisma, 'VIEWER');
      await t.http.patch(`/api/users/${user.id}`).set(auth(admin.token)).send({}).expect(400);
      await t.http
        .patch(`/api/users/${user.id}`)
        .set(auth(admin.token))
        .send({ role: 'OWNER' })
        .expect(400);
      await t.http
        .patch('/api/users/nope')
        .set(auth(admin.token))
        .send({ active: true })
        .expect(400);
      await t.http
        .patch('/api/users/00000000-0000-4000-8000-000000000000')
        .set(auth(admin.token))
        .send({ active: true })
        .expect(404);
    });
  });

  describe('deleting an employee', () => {
    it('deletes their login and ends their sessions', async () => {
      const user = await insertUser(t.prisma, 'VIEWER');
      const { token } = await signIn(t.http, user.email);
      await t.http.delete(`/api/employees/${user.employeeId}`).set(auth(admin.token)).expect(204);
      expect(await t.prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
      await t.http.get('/api/me').set(auth(token)).expect(401);
    });

    it('refuses deleting your own employee record', async () => {
      const me = await t.prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
      const res = await t.http
        .delete(`/api/employees/${me.employeeId}`)
        .set(auth(admin.token))
        .expect(409);
      expect(res.body.code).toBe('CANNOT_CHANGE_SELF');
    });
  });

  describe('the account audit trail', () => {
    it('records each change, attributed to the admin, and never a password', async () => {
      const person = await hire('6030');
      await t.http
        .patch(`/api/users/${person.userId}`)
        .set(auth(admin.token))
        .send({ role: 'ADMIN' })
        .expect(200);
      await t.http
        .patch(`/api/users/${person.userId}`)
        .set(auth(admin.token))
        .send({ active: false })
        .expect(200);
      await t.http.post(`/api/users/${person.userId}/reset-password`).set(auth(admin.token));

      const rows = await t.prisma.userAudit.findMany({
        where: { userId: person.userId },
        orderBy: { id: 'asc' },
      });
      expect(rows.map((r) => r.action)).toEqual([
        'CREATE',
        'ROLE_CHANGE',
        'DEACTIVATE',
        'PASSWORD_RESET',
      ]);
      expect(rows.every((r) => r.changedBy === admin.id)).toBe(true);
      expect(rows[1]!.details).toEqual({ from: 'VIEWER', to: 'ADMIN' });
      const text = JSON.stringify(rows, (_k, v: unknown) =>
        typeof v === 'bigint' ? String(v) : v,
      );
      expect(text).not.toContain('$argon2');

      const page = await t.http
        .get('/api/audit/accounts?action=ROLE_CHANGE')
        .set(auth(admin.token))
        .expect(200);
      expect(page.body.items[0]).toMatchObject({
        email: person.email,
        action: 'ROLE_CHANGE',
        changedBy: { id: admin.id },
      });
    });

    it('records a user changing their own password, attributed to them', async () => {
      const person = await hire('6031');
      await t.http
        .post('/api/auth/password')
        .set(auth(person.token))
        .send({ currentPassword: person.temporaryPassword, newPassword: 'chosen by myself ok' })
        .expect(200);
      const last = await t.prisma.userAudit.findFirstOrThrow({
        where: { userId: person.userId },
        orderBy: { id: 'desc' },
      });
      expect(last).toMatchObject({ action: 'PASSWORD_CHANGE', changedBy: person.userId });
    });

    it('records nothing for an ordinary sign-in', async () => {
      const user = await insertUser(t.prisma, 'VIEWER');
      const before = await t.prisma.userAudit.count({ where: { userId: user.id } });
      await signIn(t.http, user.email);
      expect(await t.prisma.userAudit.count({ where: { userId: user.id } })).toBe(before);
    });
  });
});

describe('the last admin', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startTestApp({}, { unthrottled: true });
  });
  afterAll(() => t?.close());

  it('survives two admins removing each other at the same moment', async () => {
    const a = await insertUser(t.prisma, 'ADMIN');
    const b = await insertUser(t.prisma, 'ADMIN');
    const [tokenA, tokenB] = await Promise.all([
      signIn(t.http, a.email).then((s) => s.token),
      signIn(t.http, b.email).then((s) => s.token),
    ]);

    for (const body of [{ role: 'VIEWER' }, { active: false }]) {
      const results = await Promise.all([
        t.http.patch(`/api/users/${b.id}`).set(auth(tokenA)).send(body),
        t.http.patch(`/api/users/${a.id}`).set(auth(tokenB)).send(body),
      ]);
      const statuses = results.map((r) => r.status).sort();
      // One wins. The other is refused: as the last admin if it got as far as counting, or
      // as no longer an admin if the first had already finished.
      expect(statuses[0]).toBe(200);
      expect([403, 409, 401]).toContain(statuses[1]);
      expect(await t.prisma.user.count({ where: { role: 'ADMIN', deactivatedAt: null } })).toBe(1);

      // Restore both for the next round.
      await t.prisma.user.updateMany({
        where: { id: { in: [a.id, b.id] } },
        data: { role: 'ADMIN', deactivatedAt: null },
      });
    }
  });

  it('cannot remove themselves, so one admin always remains', async () => {
    await t.prisma.user.updateMany({ where: { role: 'ADMIN' }, data: { role: 'VIEWER' } });
    const only = await insertUser(t.prisma, 'ADMIN');
    const { token } = await signIn(t.http, only.email);
    for (const body of [{ role: 'VIEWER' }, { active: false }]) {
      await t.http.patch(`/api/users/${only.id}`).set(auth(token)).send(body).expect(409);
    }
    await t.http.delete(`/api/employees/${only.employeeId}`).set(auth(token)).expect(409);
    expect(await t.prisma.user.count({ where: { role: 'ADMIN', deactivatedAt: null } })).toBe(1);
  });
});
