import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { admin, expect, signIn, test } from './fixtures';

/**
 * What a scanner sees from outside (ADR-0034), checked against the running stack: the
 * response headers, the CSP in practice, and what the edge refuses to serve.
 */

/** The CSP CloudFront sends, read from Terraform, so the stand-in cannot drift from it. */
function terraformCsp(): Map<string, string> {
  const tf = readFileSync(
    fileURLToPath(new URL('../../../infra/modules/cdn/main.tf', import.meta.url)),
    'utf8',
  );
  const block = /content_security_policy = join\("; ", \[([\s\S]*?)\]\)/.exec(tf)?.[1] ?? '';
  return directives([...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]!).join('; '));
}

function directives(csp: string): Map<string, string> {
  return new Map(
    csp
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name!, values.join(' ')] as const;
      }),
  );
}

test.describe('the public surface', () => {
  test('sends the hardening headers on the app', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['strict-transport-security']).toMatch(/max-age=63072000/);
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
  });

  test('sends the same CSP as the CloudFront policy in Terraform', async ({ request }) => {
    const served = directives((await request.get('/')).headers()['content-security-policy'] ?? '');
    const expected = terraformCsp();
    expect(expected.size).toBeGreaterThan(5);
    for (const [name, value] of expected) {
      // Not sent locally: it would upgrade http://localhost to https.
      if (name === 'upgrade-insecure-requests') continue;
      // Production also allows the avatar bucket, which the stack does not have.
      if (name === 'connect-src') {
        expect(served.get(name)).toBe("'self'");
        continue;
      }
      expect(served.get(name), name).toBe(value);
    }
  });

  test('runs every page without a single CSP violation', async ({ page }) => {
    const violations: string[] = [];
    // Runs in the page, so it is passed as source rather than a Node-typed function.
    await page.addInitScript({
      content: `document.addEventListener('securitypolicyviolation', (e) =>
        console.error('CSP violation: ' + e.violatedDirective + ' ' + e.blockedURI));`,
    });
    page.on('console', (m) => {
      if (m.text().includes('CSP violation') || m.text().includes('Content Security Policy')) {
        violations.push(m.text());
      }
    });

    await signIn(page, admin);
    for (const [path, heading] of [
      ['/', admin.name],
      ['/employees', 'Employees'],
      ['/hierarchy', 'Org chart'],
      ['/audit', 'Audit trail'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    }
    await page.goto('/hierarchy');
    await page.getByRole('button', { name: /Find an employee/ }).click();
    await page.getByPlaceholder('Name, role or employee number').fill('Thandi');
    await page.getByRole('option', { name: /Thandi Nkosi/ }).click();
    await expect(page.getByRole('complementary')).toBeVisible();

    expect(violations).toEqual([]);
  });

  test('answers 404 for dotfiles instead of serving the app', async ({ request }) => {
    for (const path of [
      '/.git/config',
      '/.git/HEAD',
      '/.env',
      '/.aws/credentials',
      '/a/.ssh/id_rsa',
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });

  test('publishes no source maps', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]!);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      const body = await (await request.get(script)).text();
      expect(body).not.toContain('sourceMappingURL');
      expect((await request.get(`${script}.map`)).status()).toBe(404);
    }
  });

  test('does not serve the API docs', async ({ request }) => {
    expect((await request.get('/api/docs')).status()).toBe(404);
    expect((await request.get('/api/docs-json')).status()).toBe(404);
  });

  test('keeps every data route behind sign-in', async ({ request }) => {
    for (const path of [
      '/api/employees',
      '/api/hierarchy',
      '/api/audit',
      '/api/me',
      '/api/me/tasks',
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
      expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
    }
  });

  test('sets the refresh cookie httpOnly, Secure, SameSite=Lax and scoped to /api/auth', async ({
    request,
  }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: admin.email, password: admin.password },
    });
    const cookie = res.headers()['set-cookie'] ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    // The access token travels in the body, never a cookie.
    expect(cookie).not.toMatch(/eyJ/);
  });
});
