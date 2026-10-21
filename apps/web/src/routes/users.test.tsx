import type { UserSummary } from '@epiuse/shared';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersRoute } from './users';

const ME = '00000000-0000-4000-8000-0000000000aa';
let isAdmin = true;
let users: UserSummary[] = [];

vi.mock('@/features/auth/session', () => ({
  useIsAdmin: () => isAdmin,
  useCurrentUser: () => ({ id: ME, email: 'me@example.com', role: 'ADMIN' }),
}));
vi.mock('@/features/users/api', () => ({
  useUsers: () => ({ isPending: false, isError: false, data: { users } }),
  useUpdateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResetPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const user = (id: string, first: string, overrides: Partial<UserSummary> = {}): UserSummary => ({
  id,
  email: `${first.toLowerCase()}@example.com`,
  role: 'VIEWER',
  status: 'active',
  lastLoginAt: null,
  employee: {
    id: `${id.slice(0, -2)}ee`,
    employeeNumber: 'E-0001',
    firstName: first,
    lastName: 'Test',
    position: 'Analyst',
    avatarUrl: null,
  },
  ...overrides,
});

describe('UsersRoute', () => {
  beforeEach(() => {
    isAdmin = true;
    users = [
      user(ME, 'Me', { role: 'ADMIN', lastLoginAt: '2026-10-20T08:00:00.000Z' }),
      user('00000000-0000-4000-8000-0000000000b1', 'Busi', { status: 'must_change_password' }),
      user('00000000-0000-4000-8000-0000000000b2', 'Sipho', { status: 'no_password' }),
      user('00000000-0000-4000-8000-0000000000b3', 'Zanele', { status: 'deactivated' }),
    ];
  });

  it('lists every login with its access and status', () => {
    render(<UsersRoute />);
    expect(screen.getByText('4 logins, 1 admin.', { exact: false })).toBeVisible();
    const busi = screen.getByRole('row', { name: /Busi Test/ });
    expect(within(busi).getByText('Regular user')).toBeVisible();
    expect(within(busi).getByText('Has a one-time password')).toBeVisible();
    expect(within(busi).getByText('Never')).toBeVisible();
    expect(screen.getByText('No password yet')).toBeVisible();
    expect(screen.getByText('Deactivated')).toBeVisible();
  });

  it("won't let an admin change their own access", () => {
    render(<UsersRoute />);
    expect(screen.getByRole('button', { name: 'Access for Me Test' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Access for Busi Test' })).toBeEnabled();
  });

  it('is closed to regular users', () => {
    isAdmin = false;
    render(<UsersRoute />);
    expect(screen.getByRole('heading', { name: 'Managing users is for admins' })).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
