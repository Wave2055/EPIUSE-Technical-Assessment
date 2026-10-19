import { PASSWORD, insertUser, startTestApp, type TestApp } from './support/test-app.js';

/**
 * Its own app, so the in-memory counters start empty and the blocked address cannot spill
 * into the other suites' sign-ins.
 */
describe('rate limiting', () => {
  let t: TestApp;
  let email: string;

  beforeAll(async () => {
    t = await startTestApp();
    email = (await insertUser(t.prisma, 'ADMIN')).email;
  });
  afterAll(() => t?.close());

  it('limits every route, before authentication', async () => {
    const res = await t.http.get('/api/employees').expect(401);
    expect(res.headers['x-ratelimit-limit']).toBe('300');
  });

  it('leaves the health check unthrottled', async () => {
    const res = await t.http.get('/api/health').expect(200);
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('blocks sign-in after ten attempts, even with the right password', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await t.http.post('/api/auth/login').send({ email, password: 'wrong-password' }).expect(401);
    }

    const blocked = await t.http
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(429);
    expect(blocked.body).toEqual({ code: 'RATE_LIMITED', message: expect.any(String) });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
