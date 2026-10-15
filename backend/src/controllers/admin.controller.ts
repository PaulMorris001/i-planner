import { Response } from 'express';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { getAnalytics } from '../services/adminAnalytics';
import { getFullLeaderboard, type LeaderboardScope } from '../services/adminLeaderboard';
import { listUsers, restoreUser, suspendUser, type UserFilter } from '../services/adminUsers';
import { listAnnouncements, previewAudience, sendAnnouncement } from '../services/adminAnnouncements';

const FILTERS: UserFilter[] = ['all', 'suspended', 'paid', 'free', 'admins'];

function intParam(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

// GET /admin/me - lets the app confirm with the server that this account really is an admin.
export function getAdminMe(req: AuthedRequest, res: Response) {
  res.json({ admin: true, email: req.userEmail ?? null });
}

export async function getAdminAnalytics(_req: AuthedRequest, res: Response) {
  res.json(await getAnalytics());
}

export async function getAdminUsers(req: AuthedRequest, res: Response) {
  const filter = FILTERS.includes(req.query.filter as UserFilter) ? (req.query.filter as UserFilter) : 'all';
  res.json(
    await listUsers({
      search: typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined,
      filter,
      page: intParam(req.query.page, 1),
      pageSize: intParam(req.query.pageSize, 25),
    })
  );
}

export async function postSuspendUser(req: AuthedRequest, res: Response) {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
  await suspendUser(req.userId!, req.params.uid, reason);
  res.status(204).send();
}

export async function postRestoreUser(req: AuthedRequest, res: Response) {
  await restoreUser(req.params.uid);
  res.status(204).send();
}

export async function getAdminLeaderboard(req: AuthedRequest, res: Response) {
  const scope: LeaderboardScope = req.query.scope === 'all' ? 'all' : 'week';
  res.json(await getFullLeaderboard(scope, intParam(req.query.page, 1), intParam(req.query.pageSize, 50)));
}

export async function getAdminAnnouncements(_req: AuthedRequest, res: Response) {
  const [history, audience] = await Promise.all([listAnnouncements(20), previewAudience()]);
  res.json({ audience, history });
}

export async function postAnnouncement(req: AuthedRequest, res: Response) {
  if (typeof req.body !== 'object' || req.body === null) throw new ApiError(400, 'Missing announcement.', 'general');
  const outcome = await sendAnnouncement({ uid: req.userId!, email: req.userEmail }, req.body);
  res.status(201).json(outcome);
}
