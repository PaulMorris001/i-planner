import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firebase = vi.hoisted(() => ({ currentUser: null as null | { getIdToken: () => Promise<string> } }));
vi.mock('@/lib/firebase', () => ({ auth: firebase }));

import { apiRequest, setUnauthorizedHandler } from '@/lib/api';
import { adminApi } from '@/lib/adminApi';
import { formatCount, formatResetsIn, initials, plural, timeAgo } from '@/lib/format';

const fetchMock = vi.fn();

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, text: async () => (body === null ? '' : JSON.stringify(body)) });
}

beforeEach(() => {
  firebase.currentUser = { getIdToken: async () => 'TOKEN' };
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  setUnauthorizedHandler(null);
});
afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('sends the admin token and reads JSON', async () => {
    respond(200, { ok: true });
    const result = await apiRequest<{ ok: boolean }>('/admin/analytics');
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/admin\/analytics$|\/admin\/analytics$/);
    expect(init.headers.Authorization).toBe('Bearer TOKEN');
  });

  it('accepts an empty 204 response', async () => {
    respond(204, null);
    await expect(apiRequest('/admin/users/x/suspend', { method: 'POST', body: {} })).resolves.toBeNull();
  });

  it('without a signed-in user it fails before any request', async () => {
    firebase.currentUser = null;
    await expect(apiRequest('/admin/me')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns a server error into a readable message and status', async () => {
    respond(400, { message: "You can't suspend your own account.", field: 'general' });
    await expect(apiRequest('/admin/users/x/suspend', { method: 'POST' })).rejects.toMatchObject({
      message: "You can't suspend your own account.",
      status: 400,
    });
  });

  it('a network failure becomes a friendly error, not a raw exception', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiRequest('/admin/analytics')).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/reach the server/i) });
  });

  it('a 401 signs the dashboard out', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    respond(401, { message: 'Invalid or expired session.' });
    await expect(apiRequest('/admin/analytics')).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('an ordinary validation error does NOT sign anyone out', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    respond(400, { message: 'Give the announcement a title.', field: 'title' });
    await expect(apiRequest('/admin/announcements', { method: 'POST', body: {} })).rejects.toMatchObject({ field: 'title' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('tolerates a non-JSON error body', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, text: async () => '<html>Bad gateway</html>' });
    await expect(apiRequest('/admin/analytics')).rejects.toMatchObject({ status: 502, message: 'Something went wrong.' });
  });
});

describe('adminApi', () => {
  it('builds the users query (search, filter, paging) and skips the default filter', async () => {
    respond(200, { users: [], total: 0, page: 1, pageSize: 25 });
    await adminApi.users({ search: 'ada & bob', filter: 'suspended', page: 3, pageSize: 10 });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('search=ada+%26+bob');
    expect(url).toContain('filter=suspended');
    expect(url).toContain('page=3');
    expect(url).toContain('pageSize=10');
    await adminApi.users({ filter: 'all' });
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('filter=');
  });

  it('encodes the user id in the suspend path', async () => {
    respond(204, null);
    await adminApi.suspend('a/b c', 'spam');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/admin/users/a%2Fb%20c/suspend');
    expect(JSON.parse(init.body)).toEqual({ reason: 'spam' });
  });

  it('asks for the right leaderboard scope and page', async () => {
    respond(200, { rows: [], total: 0, page: 2, pageSize: 50 });
    await adminApi.leaderboard('all', 2, 50);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/admin/leaderboard?scope=all&page=2&pageSize=50');
  });
});

describe('format helpers', () => {
  const now = Date.parse('2026-10-15T12:00:00Z');
  it('timeAgo', () => {
    expect(timeAgo(null, now)).toBe('never');
    expect(timeAgo('2026-10-15T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-15T11:30:00Z', now)).toBe('30 min ago');
    expect(timeAgo('2026-10-15T07:00:00Z', now)).toBe('5 h ago');
    expect(timeAgo('2026-10-12T12:00:00Z', now)).toBe('3 d ago');
  });
  it('formatCount, plural, initials', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(plural(1, 'account', 'accounts')).toBe('account');
    expect(plural(0, 'account', 'accounts')).toBe('accounts');
    expect(initials('Ada Lovelace King')).toBe('AL');
    expect(initials('  ')).toBe('?');
  });
  it('formatResetsIn', () => {
    expect(formatResetsIn('2026-10-18T16:00:00Z', now)).toBe('Resets in 3d 4h');
    expect(formatResetsIn('2026-10-15T17:00:00Z', now)).toBe('Resets in 5h');
    expect(formatResetsIn('2026-10-15T12:20:00Z', now)).toBe('Resets in 20m');
    expect(formatResetsIn('2026-10-14T00:00:00Z', now)).toBe('Resetting now');
  });
});
