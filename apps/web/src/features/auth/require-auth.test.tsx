import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireAuth } from './require-auth';
import type { Session } from './session';

let session: Session = { status: 'signedOut' };
vi.mock('./session', () => ({ useSession: () => session }));

const user = (mustChangePassword: boolean) => ({
  id: '00000000-0000-4000-8000-000000000001',
  email: 'a@example.com',
  role: 'VIEWER' as const,
  employeeId: null,
  mustChangePassword,
});

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route
          path="/change-password"
          element={
            <RequireAuth>
              <p>Change password page</p>
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <RequireAuth>
              <p>App page</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('sends a signed-out visitor to sign in', () => {
    session = { status: 'signedOut' };
    renderAt('/employees');
    expect(screen.getByText('Login page')).toBeVisible();
  });

  it('holds someone on a one-time password on the change-password page', () => {
    session = { status: 'signedIn', user: user(true) };
    renderAt('/employees');
    expect(screen.getByText('Change password page')).toBeVisible();
  });

  it('lets them stay on the change-password page itself', () => {
    session = { status: 'signedIn', user: user(true) };
    renderAt('/change-password');
    expect(screen.getByText('Change password page')).toBeVisible();
  });

  it('lets everyone else through', () => {
    session = { status: 'signedIn', user: user(false) };
    renderAt('/employees');
    expect(screen.getByText('App page')).toBeVisible();
  });
});
