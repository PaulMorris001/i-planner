import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = {
  status: 'signedOut' as 'loading' | 'signedOut' | 'notAdmin' | 'admin',
  user: null as { email: string } | null,
  signIn: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/auth/AuthProvider', async () => {
  const actual = await vi.importActual<typeof import('@/auth/AuthProvider')>('@/auth/AuthProvider');
  return { ...actual, useAuth: () => auth };
});
vi.mock('@/lib/firebase', () => ({ auth: {} }));

import { RequireAdmin } from '@/auth/RequireAdmin';
import { friendlySignInError } from '@/auth/AuthProvider';
import { LoginPage } from '@/pages/LoginPage';

function renderApp(initial = '/') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAdmin>
              <div>SECRET DASHBOARD</div>
            </RequireAdmin>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  auth.status = 'signedOut';
  auth.user = null;
  auth.signIn = vi.fn();
  auth.logout = vi.fn();
});

describe('route guard', () => {
  it('shows nothing of the dashboard while the role is being read', () => {
    auth.status = 'loading';
    renderApp('/');
    expect(screen.queryByText('SECRET DASHBOARD')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('sends a signed-out visitor to the login page', () => {
    renderApp('/');
    expect(screen.queryByText('SECRET DASHBOARD')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /i-planner admin/i })).toBeInTheDocument();
  });

  it('turns away a signed-in account that is not an admin, and says so', () => {
    auth.status = 'notAdmin';
    auth.user = { email: 'user@mail.test' };
    renderApp('/');
    expect(screen.queryByText('SECRET DASHBOARD')).not.toBeInTheDocument();
    expect(screen.getByText(/doesn't have admin access/i)).toBeInTheDocument();
  });

  it('lets an admin through', () => {
    auth.status = 'admin';
    renderApp('/');
    expect(screen.getByText('SECRET DASHBOARD')).toBeInTheDocument();
  });
});

describe('login page', () => {
  it('cannot submit until both fields are filled', async () => {
    renderApp('/login');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Email'), 'boss@co.test');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });

  it('signs in with the typed credentials', async () => {
    auth.signIn.mockResolvedValue(undefined);
    renderApp('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'boss@co.test');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(auth.signIn).toHaveBeenCalledWith('boss@co.test', 'secret123');
  });

  it('shows a friendly message for a wrong password, never the raw Firebase error', async () => {
    auth.signIn.mockRejectedValue({ code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' });
    renderApp('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'boss@co.test');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
    expect(screen.queryByText(/Firebase/)).not.toBeInTheDocument();
  });

  it('a signed-in non-admin sees the denial and can sign out', async () => {
    auth.status = 'notAdmin';
    renderApp('/login');
    expect(screen.getByText(/doesn't have admin access/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(auth.logout).toHaveBeenCalled();
  });

  it('an admin who lands on /login is taken to the dashboard', async () => {
    auth.status = 'admin';
    renderApp('/login');
    await waitFor(() => expect(screen.queryByLabelText('Password')).not.toBeInTheDocument());
  });
});

describe('friendlySignInError', () => {
  it.each([
    ['auth/user-disabled', 'This account has been suspended.'],
    ['auth/too-many-requests', 'Too many attempts. Please wait a moment and try again.'],
    ['auth/network-request-failed', 'Network error. Check your connection and try again.'],
    ['auth/invalid-email', 'That email address looks invalid.'],
    ['auth/wrong-password', 'Incorrect email or password.'],
    ['something-else', 'Incorrect email or password.'],
  ])('%s', (code, message) => {
    expect(friendlySignInError({ code })).toBe(message);
  });
});
