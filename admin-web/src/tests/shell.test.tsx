import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ user: { email: 'boss@co.test' }, logout: vi.fn() }));
vi.mock('@/auth/AuthProvider', async () => {
  const actual = await vi.importActual<typeof import('@/auth/AuthProvider')>('@/auth/AuthProvider');
  return { ...actual, useAuth: () => auth };
});
vi.mock('@/lib/firebase', () => ({ auth: {} }));

import { AppShell, SIDEBAR_STORAGE_KEY } from '@/components/layout/AppShell';

const renderShell = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>HOME PAGE</div>} />
          <Route path="users" element={<div>USERS PAGE</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

const shell = () => document.querySelector('.shell') as HTMLElement;

beforeEach(() => {
  window.localStorage.clear();
  auth.logout = vi.fn();
});

describe('side menu', () => {
  it('starts open, with every section reachable', () => {
    renderShell();
    expect(shell()).not.toHaveClass('collapsed');
    for (const label of ['Analytics', 'Announcements', 'Users', 'Leaderboard', 'Account']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Collapse menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses to the icon rail and opens again', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse menu' }));
    expect(shell()).toHaveClass('collapsed');
    // every section is still there (as icons) and now named by its tooltip
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('title', 'Users');
    const expand = screen.getByRole('button', { name: 'Expand menu' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(expand);
    expect(shell()).not.toHaveClass('collapsed');
  });

  it('remembers the choice', async () => {
    const { unmount } = renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse menu' }));
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    unmount();
    renderShell();
    expect(shell()).toHaveClass('collapsed');
  });

  it('navigating keeps it collapsed', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse menu' }));
    await userEvent.click(screen.getByRole('link', { name: 'Users' }));
    expect(screen.getByText('USERS PAGE')).toBeInTheDocument();
    expect(shell()).toHaveClass('collapsed');
  });

  it('still works when the browser blocks storage', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderShell();
    expect(shell()).not.toHaveClass('collapsed');
    await userEvent.click(screen.getByRole('button', { name: 'Collapse menu' }));
    expect(shell()).toHaveClass('collapsed');
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('the drawer button opens and a scrim click closes it (small screens)', async () => {
    renderShell();
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    expect(sidebar).not.toHaveClass('open');
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(sidebar).toHaveClass('open');
    await userEvent.click(document.querySelector('.scrim') as HTMLElement);
    expect(sidebar).not.toHaveClass('open');
  });

  it('choosing a section closes the drawer', async () => {
    renderShell();
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(sidebar).toHaveClass('open');
    await userEvent.click(screen.getByRole('link', { name: 'Users' }));
    expect(sidebar).not.toHaveClass('open');
  });

  it('sign out is reachable in both states', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.logout).toHaveBeenCalled();
  });
});
