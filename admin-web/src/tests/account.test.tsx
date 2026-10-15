import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  user: { email: 'boss@co.test' },
  changePassword: vi.fn(),
}));
vi.mock('@/auth/AuthProvider', async () => {
  const actual = await vi.importActual<typeof import('@/auth/AuthProvider')>('@/auth/AuthProvider');
  return { ...actual, useAuth: () => auth };
});
vi.mock('@/lib/firebase', () => ({ auth: {} }));

import { friendlyPasswordError } from '@/auth/AuthProvider';
import { AccountPage, passwordProblem } from '@/pages/AccountPage';

const show = () =>
  render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>
  );

const fill = async (current: string, next: string, confirm: string) => {
  await userEvent.type(screen.getByLabelText('Current password'), current);
  await userEvent.type(screen.getByLabelText('New password'), next);
  await userEvent.type(screen.getByLabelText('Confirm new password'), confirm);
};

beforeEach(() => {
  auth.changePassword = vi.fn();
});

describe('passwordProblem', () => {
  it('reports the first thing to fix', () => {
    expect(passwordProblem('', 'newpass123', 'newpass123')).toMatch(/current password/);
    expect(passwordProblem('old', 'short', 'short')).toMatch(/at least 8/);
    expect(passwordProblem('samepass1', 'samepass1', 'samepass1')).toMatch(/different/);
    expect(passwordProblem('old-pass', 'newpass123', 'newpass124')).toMatch(/don't match/);
    expect(passwordProblem('old-pass', 'newpass123', 'newpass123')).toBe('');
  });
});

describe('change password page', () => {
  it('shows whose account it is and keeps the button off until the form is valid', async () => {
    show();
    expect(screen.getByText('boss@co.test')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Change password' });
    expect(button).toBeDisabled();
    await fill('old-pass-1', 'brand-new-1', 'brand-new-2');
    expect(screen.getByText(/don't match/i)).toBeInTheDocument();
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Confirm new password'), '{backspace}1');
    expect(button).toBeEnabled();
  });

  it('changes the password with the typed values and clears the form', async () => {
    auth.changePassword.mockResolvedValue(undefined);
    show();
    await fill('old-pass-1', 'brand-new-1', 'brand-new-1');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(auth.changePassword).toHaveBeenCalledWith('old-pass-1', 'brand-new-1'));
    expect(await screen.findByText(/Your password has been changed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });

  it('a wrong current password is explained, and what was typed is kept', async () => {
    auth.changePassword.mockRejectedValue({ code: 'auth/invalid-credential' });
    show();
    await fill('wrong-pass-1', 'brand-new-1', 'brand-new-1');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue('brand-new-1');
    expect(screen.queryByText(/has been changed/)).not.toBeInTheDocument();
  });

  it('can show the passwords while typing', async () => {
    show();
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByLabelText('Show passwords'));
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');
  });

  it('does not submit twice while it is working', async () => {
    let resolve: () => void = () => undefined;
    auth.changePassword.mockImplementation(() => new Promise<void>((r) => (resolve = r)));
    show();
    await fill('old-pass-1', 'brand-new-1', 'brand-new-1');
    const button = screen.getByRole('button', { name: 'Change password' });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(auth.changePassword).toHaveBeenCalledTimes(1);
    resolve();
    await screen.findByText(/has been changed/);
  });
});

describe('friendlyPasswordError', () => {
  it.each([
    ['auth/wrong-password', 'Your current password is incorrect.'],
    ['auth/invalid-credential', 'Your current password is incorrect.'],
    ['auth/weak-password', 'Choose a stronger password (at least 8 characters).'],
    ['auth/too-many-requests', 'Too many attempts. Please wait a moment and try again.'],
    ['auth/network-request-failed', 'Network error. Check your connection and try again.'],
    ['auth/requires-recent-login', 'For your security, please sign out, sign in again, then change your password.'],
    ['anything-else', "Couldn't change your password. Please try again."],
  ])('%s', (code, message) => {
    expect(friendlyPasswordError({ code })).toBe(message);
  });
});
