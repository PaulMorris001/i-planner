import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminAnalytics, AdminUserRow, AnnouncementsOverview, LeaderboardRow } from '@/lib/types';

const api = vi.hoisted(() => ({
  me: vi.fn(),
  analytics: vi.fn(),
  users: vi.fn(),
  suspend: vi.fn(),
  restore: vi.fn(),
  leaderboard: vi.fn(),
  announcements: vi.fn(),
  sendAnnouncement: vi.fn(),
}));
vi.mock('@/lib/adminApi', () => ({ adminApi: api }));
vi.mock('@/lib/firebase', () => ({ auth: {} }));

import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { AnnouncementsPage } from '@/pages/AnnouncementsPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { UsersPage } from '@/pages/UsersPage';

const show = (el: React.ReactElement) => render(<MemoryRouter>{el}</MemoryRouter>);

const ANALYTICS: AdminAnalytics = {
  generatedAt: new Date().toISOString(),
  users: { total: 1234, newLast7Days: 56, newLast30Days: 210, suspended: 3 },
  activity: { activeNow: 17, last24Hours: 301, last7Days: 802 },
  plans: { free: 1100, student: 60, professional: 40, premium: 34, paid: 134, comped: 5 },
  devices: { ios: 700, android: 480, noDevice: 54 },
  signupsByDay: Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, i + 1)).toISOString().slice(0, 10), count: i % 4 })),
};

const user = (name: string, extra: Partial<AdminUserRow> = {}): AdminUserRow => ({
  uid: `uid-${name}`,
  name,
  email: `${name.toLowerCase()}@mail.test`,
  createdAt: new Date().toISOString(),
  lastSignInAt: null,
  lastActiveAt: null,
  tier: 'free',
  suspended: false,
  isAdmin: false,
  providers: ['password'],
  productUpdates: false,
  pushDevices: 0,
  ...extra,
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('analytics page (home)', () => {
  it('shows the live numbers, subscriptions and platforms', async () => {
    api.analytics.mockResolvedValue(ANALYTICS);
    show(<AnalyticsPage />);
    expect(await screen.findByText('ACTIVE NOW')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('1,234', { selector: '.value' })).toBeInTheDocument();
    expect(screen.getAllByText('Subscribed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('134').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Free plan').length).toBeGreaterThan(0);
    expect(screen.getByText('Student')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('iPhone / iPad')).toBeInTheDocument();
    expect(screen.getByText(/not store downloads/i)).toBeInTheDocument();
    expect(screen.getByText(/3 suspended accounts/i)).toBeInTheDocument();
  });

  it('never invents download numbers', async () => {
    api.analytics.mockResolvedValue(ANALYTICS);
    show(<AnalyticsPage />);
    await screen.findByText('ACTIVE NOW');
    expect(screen.queryByText(/downloads\s*:?\s*\d/i)).not.toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    api.analytics.mockRejectedValueOnce({ message: 'Could not reach the server.' }).mockResolvedValue(ANALYTICS);
    show(<AnalyticsPage />);
    expect(await screen.findByText('Could not reach the server.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('ACTIVE NOW')).toBeInTheDocument();
  });
});

describe('users page', () => {
  const rows = [
    user('Ada', { tier: 'premium', lastActiveAt: new Date().toISOString() }),
    user('Bob'),
    user('Cyn', { suspended: true, suspendedReason: 'spam' }),
    user('Root', { isAdmin: true }),
  ];

  beforeEach(() => {
    api.users.mockImplementation(async (q: { search?: string; filter?: string }) => {
      let list = rows;
      if (q.search) list = list.filter((u) => u.name.toLowerCase().includes(q.search!.toLowerCase()));
      if (q.filter === 'suspended') list = list.filter((u) => u.suspended);
      return { users: list, total: list.length, page: 1, pageSize: 25 };
    });
  });

  it('lists names, emails, ids, plans and states', async () => {
    show(<UsersPage />);
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@mail.test')).toBeInTheDocument();
    expect(screen.getByText(/ID uid-Ada/)).toBeInTheDocument();
    expect(screen.getByText('PREMIUM')).toBeInTheDocument();
    expect(screen.getByText('Active now')).toBeInTheDocument();
    expect(screen.getByText(/Suspended · spam/)).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('only non-admins get a suspend button; suspended accounts get restore', async () => {
    show(<UsersPage />);
    await screen.findByText('Ada');
    expect(screen.getAllByRole('button', { name: 'Suspend account' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Restore account' })).toHaveLength(1);
  });

  it('searches after a short pause', async () => {
    show(<UsersPage />);
    await screen.findByText('Ada');
    await userEvent.type(screen.getByLabelText('Search name, email or ID'), 'bob');
    await waitFor(() => expect(api.users).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'bob', page: 1 })), { timeout: 2000 });
    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Ada')).not.toBeInTheDocument();
  });

  it('filters by suspended', async () => {
    show(<UsersPage />);
    await screen.findByText('Ada');
    await userEvent.click(screen.getByRole('button', { name: 'Suspended' }));
    await waitFor(() => expect(api.users).toHaveBeenLastCalledWith(expect.objectContaining({ filter: 'suspended' })));
    expect(await screen.findByText('Cyn')).toBeInTheDocument();
  });

  it('asks before suspending, then suspends with the reason and updates the row in place', async () => {
    api.suspend.mockResolvedValue(undefined);
    show(<UsersPage />);
    const card = (await screen.findByText('Bob')).closest('article')!;
    await userEvent.click(within(card).getByRole('button', { name: 'Suspend account' }));
    expect(screen.getByRole('dialog', { name: /suspend this account/i })).toBeInTheDocument();
    expect(api.suspend).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Reason'), '  abusive  ');
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    await waitFor(() => expect(api.suspend).toHaveBeenCalledWith('uid-Bob', 'abusive'));
    expect(await within(card).findByText(/Suspended · abusive/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Restore account' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a refusal from the server is shown and the account is left unchanged', async () => {
    api.suspend.mockRejectedValue({ message: "Admin accounts can't be suspended from the dashboard.", status: 400 });
    show(<UsersPage />);
    const card = (await screen.findByText('Bob')).closest('article')!;
    await userEvent.click(within(card).getByRole('button', { name: 'Suspend account' }));
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByText(/can't be suspended from the dashboard/i)).toBeInTheDocument();
    expect(within(card).queryByText(/Suspended/)).not.toBeInTheDocument();
  });

  it('restoring on the Suspended filter removes the row from the list', async () => {
    api.restore.mockResolvedValue(undefined);
    show(<UsersPage />);
    await screen.findByText('Ada');
    await userEvent.click(screen.getByRole('button', { name: 'Suspended' }));
    const card = (await screen.findByText('Cyn')).closest('article')!;
    await userEvent.click(within(card).getByRole('button', { name: 'Restore account' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(api.restore).toHaveBeenCalledWith('uid-Cyn'));
    await waitFor(() => expect(screen.queryByText('Cyn')).not.toBeInTheDocument());
  });

  it('empty and error states', async () => {
    api.users.mockResolvedValueOnce({ users: [], total: 0, page: 1, pageSize: 25 });
    const { unmount } = show(<UsersPage />);
    expect(await screen.findByText('No users found')).toBeInTheDocument();
    unmount();
    api.users.mockRejectedValueOnce({ message: 'Boom' });
    show(<UsersPage />);
    expect(await screen.findByText('Boom')).toBeInTheDocument();
  });

  it('"Show more" loads the next page without duplicating rows', async () => {
    api.users
      .mockResolvedValueOnce({ users: [user('Ada'), user('Bob')], total: 3, page: 1, pageSize: 2 })
      .mockResolvedValueOnce({ users: [user('Bob'), user('Cyn')], total: 3, page: 2, pageSize: 2 });
    show(<UsersPage />);
    await screen.findByText('Ada');
    await userEvent.click(screen.getByRole('button', { name: /show more \(1 left\)/i }));
    expect(await screen.findByText('Cyn')).toBeInTheDocument();
    expect(screen.getAllByText('Bob')).toHaveLength(1);
  });
});

describe('leaderboard page', () => {
  const row = (rank: number, name: string, points: number): LeaderboardRow => ({
    rank,
    uid: `u-${name}`,
    name,
    email: `${name.toLowerCase()}@mail.test`,
    handle: `user-${name.toLowerCase()}`,
    points,
  });

  it('shows a podium, the rest with emails, and switches to all time', async () => {
    api.leaderboard.mockImplementation(async (scope: string) =>
      scope === 'week'
        ? { rows: [row(1, 'Ada', 300), row(2, 'Bob', 200), row(3, 'Cyn', 100), row(4, 'Dan', 90)], total: 4, page: 1, pageSize: 50, weekEnd: new Date(Date.now() + 3 * 86400000).toISOString() }
        : { rows: [row(1, 'Eve', 5000)], total: 1, page: 1, pageSize: 50 }
    );
    show(<LeaderboardPage />);
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText(/dan@mail\.test/i)).toBeInTheDocument();
    expect(screen.getByText(/Resets in [23]d/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'All time' }));
    expect(await screen.findByText('Eve')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(api.leaderboard).toHaveBeenLastCalledWith('all', 1, 50);
  });

  it('explains an empty table', async () => {
    api.leaderboard.mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 50 });
    show(<LeaderboardPage />);
    expect(await screen.findByText('No points yet')).toBeInTheDocument();
  });
});

describe('announcements page', () => {
  const overview: AnnouncementsOverview = {
    audience: { pushDevices: 320, emailRecipients: 210 },
    history: [
      {
        id: 'a1',
        title: 'Old news',
        body: 'Earlier message',
        route: null,
        channels: { push: true, email: false },
        test: false,
        pushDevices: 300,
        pushAccepted: 290,
        emailRecipients: 0,
        emailSent: 0,
        sentByEmail: 'boss@co.test',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  };

  beforeEach(() => {
    api.announcements.mockResolvedValue(overview);
    api.sendAnnouncement.mockImplementation(async (draft: { test: boolean; email: boolean }) => ({
      id: 'n1',
      pushDevices: draft.test ? 1 : 320,
      pushAccepted: draft.test ? 1 : 318,
      emailRecipients: draft.email ? (draft.test ? 1 : 210) : 0,
      emailSent: draft.email ? (draft.test ? 1 : 210) : 0,
      test: draft.test,
    }));
  });

  const fill = async () => {
    await userEvent.type(screen.getByLabelText('Title'), 'Study timer is here');
    await userEvent.type(screen.getByLabelText('Message'), 'Time your sessions and earn points.');
  };

  it('shows who can be reached and what was sent before', async () => {
    show(<AnnouncementsPage />);
    expect(await screen.findByText(/320 devices can receive it/)).toBeInTheDocument();
    expect(screen.getByText(/210 inboxes can receive it/)).toBeInTheDocument();
    expect(screen.getByText('Old news')).toBeInTheDocument();
    expect(screen.getByText('PUSH 290/300')).toBeInTheDocument();
  });

  it('cannot send until there is a title and a message', async () => {
    show(<AnnouncementsPage />);
    await screen.findByText(/320 devices/);
    const send = screen.getByRole('button', { name: /send to users/i });
    expect(send).toBeDisabled();
    await fill();
    expect(send).toBeEnabled();
  });

  it('mirrors what is typed in the notification preview', async () => {
    show(<AnnouncementsPage />);
    await screen.findByText(/320 devices/);
    await fill();
    const preview = document.querySelector('.preview')!;
    expect(within(preview as HTMLElement).getByText('Study timer is here')).toBeInTheDocument();
    expect(within(preview as HTMLElement).getByText(/Time your sessions/)).toBeInTheDocument();
  });

  it('shows who is opted in and who has a push device, and filters by it', async () => {
    api.users.mockResolvedValue({
      users: [user('Ada', { productUpdates: true, pushDevices: 2 }), user('Bob', { productUpdates: true, pushDevices: 0 })],
      total: 2,
      page: 1,
      pageSize: 25,
    });
    show(<UsersPage />);
    await screen.findByText('Ada');
    expect(screen.getAllByText('UPDATES ON')).toHaveLength(2);
    expect(screen.getByText('PUSH 2')).toBeInTheDocument();
    expect(screen.getByText('NO PUSH')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'No push device' }));
    await waitFor(() => expect(api.users).toHaveBeenLastCalledWith(expect.objectContaining({ filter: 'no_push' })));
  });

  it('uses the i-Planner logo (not a placeholder icon) in the notification preview', async () => {
    show(<AnnouncementsPage />);
    await screen.findByText(/320 devices/);
    const preview = document.querySelector('.preview') as HTMLElement;
    const logo = within(preview).getByAltText('i-Planner');
    expect(logo).toHaveAttribute('src', '/logo.png');
  });

  it('shows an email preview with the logo only when email is switched on, and mirrors what is typed', async () => {
    show(<AnnouncementsPage />);
    await screen.findByText(/320 devices/);
    expect(document.querySelector('.email-preview')).toBeNull();
    await fill();
    await userEvent.click(screen.getByRole('checkbox', { name: /email/i }));
    const email = document.querySelector('.email-preview') as HTMLElement;
    expect(email).not.toBeNull();
    expect(within(email).getByAltText('i-Planner')).toHaveAttribute('src', '/logo.png');
    expect(within(email).getByRole('heading', { name: 'Study timer is here' })).toBeInTheDocument();
    expect(within(email).getByText(/Time your sessions/)).toBeInTheDocument();
    expect(within(email).getByText(/Product updates/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /email/i }));
    expect(document.querySelector('.email-preview')).toBeNull();
  });

  it('the confirm dialog previews exactly the channels that will be used', async () => {
    show(<AnnouncementsPage />);
    await screen.findByText(/320 devices/);
    await fill();
    await userEvent.click(screen.getByRole('checkbox', { name: /push notification/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /email/i }));
    await userEvent.click(screen.getByRole('button', { name: /send to users/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.email-preview')).not.toBeNull();
    expect(dialog.querySelector('.preview')).toBeNull();
  });

  it('confirms with the real reach, and sends exactly what was written to both channels', async () => {
    show(<AnnouncementsPage />);
    await screen.findByText(/320 devices/);
    await fill();
    await userEvent.click(screen.getByRole('checkbox', { name: /email/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Study' }));
    await userEvent.click(screen.getByRole('button', { name: /send to users/i }));
    const dialog = screen.getByRole('dialog', { name: /send this announcement/i });
    expect(within(dialog).getByText(/320 devices and 210 inboxes/)).toBeInTheDocument();
    expect(api.sendAnnouncement).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send now' }));
    await waitFor(() =>
      expect(api.sendAnnouncement).toHaveBeenCalledWith({
        title: 'Study timer is here',
        body: 'Time your sessions and earn points.',
        route: '/study',
        push: true,
        email: true,
        test: false,
      })
    );
    expect(await screen.findByText(/Announcement sent/)).toBeInTheDocument();
    expect(screen.getByText(/318 of 320 devices/)).toBeInTheDocument();
    // the composer is cleared for the next one
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  it('a test goes only to me and keeps the text', async () => {
    show(<AnnouncementsPage />);
    await screen.findByText(/320 devices/);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /send test to me/i }));
    expect(screen.getByText(/Only you will receive this test/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send test' }));
    await waitFor(() => expect(api.sendAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ test: true })));
    expect(screen.getByLabelText('Title')).toHaveValue('Study timer is here');
  });

  it('with no channel chosen it says so and cannot send', async () => {
    show(<AnnouncementsPage />);
    await screen.findByText(/320 devices/);
    await fill();
    await userEvent.click(screen.getByRole('checkbox', { name: /push notification/i }));
    expect(screen.getByText(/Choose at least one way to send it/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send to users/i })).toBeDisabled();
  });

  it('a failed send shows the server message and keeps the dialog open', async () => {
    api.sendAnnouncement.mockRejectedValue({ message: 'An announcement is already being sent. Wait for it to finish.' });
    show(<AnnouncementsPage />);
    await screen.findByText(/320 devices/);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /send to users/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Send now' }));
    expect(await screen.findByText(/already being sent/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('explains an empty history', async () => {
    api.announcements.mockResolvedValue({ audience: { pushDevices: 0, emailRecipients: 0 }, history: [] });
    show(<AnnouncementsPage />);
    expect(await screen.findByText('Nothing sent yet')).toBeInTheDocument();
  });
});
