import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OneTimePasswordDialog } from './one-time-password';
import { currentOneTimePassword, showOneTimePassword } from './one-time-password-store';

describe('OneTimePasswordDialog', () => {
  it('shows the password once, copies it, and forgets it when closed', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<OneTimePasswordDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() =>
      showOneTimePassword({
        name: 'Sipho Ndlovu',
        email: 'sipho@example.com',
        temporaryPassword: 'Abcd2345Efgh6789',
        reason: 'created',
      }),
    );
    expect(screen.getByRole('heading', { name: 'Login created' })).toBeVisible();
    expect(screen.getByLabelText('One-time password')).toHaveTextContent('Abcd2345Efgh6789');
    expect(screen.getByText(/won.t be shown again/)).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(writeText).toHaveBeenCalledWith('Abcd2345Efgh6789');
    expect(screen.getByRole('button', { name: /Copied/ })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(currentOneTimePassword()).toBeNull();
    expect(screen.queryByText('Abcd2345Efgh6789')).not.toBeInTheDocument();
  });

  it('says the old password stopped working after a reset', () => {
    render(<OneTimePasswordDialog />);
    act(() =>
      showOneTimePassword({
        name: 'Sipho Ndlovu',
        email: 'sipho@example.com',
        temporaryPassword: 'x',
        reason: 'reset',
      }),
    );
    expect(screen.getByRole('heading', { name: 'New one-time password' })).toBeVisible();
    expect(screen.getByText(/old password no longer works/)).toBeVisible();
  });
});
