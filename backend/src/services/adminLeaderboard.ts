import { PointEvent } from '../models/PointEvent';
import { ReferralProfile } from '../models/ReferralProfile';
import { getDirectory } from './adminUsers';
import { weekBounds } from './referralLeaderboard';

export type LeaderboardScope = 'week' | 'all';

export interface AdminLeaderboardRow {
  rank: number;
  uid: string;
  name: string;
  email: string;
  handle: string | null;
  points: number;
}

const MAX_PAGE_SIZE = 100;

// The whole points table for the dashboard (the in-app leaderboard shows only the top ten, and
// only handles). Same ordering rule: most points first; on a tie, whoever got there first.
// `week` is this week's standings from the points record; `all` is every account's running total.
// Accounts that no longer exist in Firebase are left out.
export async function getFullLeaderboard(
  scope: LeaderboardScope,
  page = 1,
  pageSize = 50,
  now: number = Date.now()
): Promise<{ rows: AdminLeaderboardRow[]; total: number; page: number; pageSize: number; weekStart?: string; weekEnd?: string }> {
  const size = Math.min(Math.max(Math.floor(pageSize), 1), MAX_PAGE_SIZE);
  const pageNumber = Math.max(Math.floor(page), 1);
  const skip = (pageNumber - 1) * size;

  const directory = await getDirectory();
  const byUid = new Map(directory.map((u) => [u.uid, u]));
  const existingUids = [...byUid.keys()];

  let ranked: { uid: string; points: number }[];
  let total: number;
  let window: { start: Date; end: Date } | undefined;

  if (scope === 'week') {
    window = weekBounds(now);
    const match = { createdAt: { $gte: window.start, $lt: window.end }, firebaseUid: { $in: existingUids } };
    const grouped = [
      { $match: match },
      { $group: { _id: '$firebaseUid', points: { $sum: '$points' }, reachedAt: { $max: '$createdAt' } } },
      { $match: { points: { $gt: 0 } } },
    ];
    const [rows, count] = await Promise.all([
      PointEvent.aggregate<{ _id: string; points: number }>([
        ...grouped,
        { $sort: { points: -1, reachedAt: 1, _id: 1 } },
        { $skip: skip },
        { $limit: size },
      ]),
      PointEvent.aggregate<{ n: number }>([...grouped, { $count: 'n' }]),
    ]);
    ranked = rows.map((r) => ({ uid: r._id, points: r.points }));
    total = count[0]?.n ?? 0;
  } else {
    const filter = { points: { $gt: 0 }, firebaseUid: { $in: existingUids } };
    const [rows, count] = await Promise.all([
      ReferralProfile.find(filter, { firebaseUid: 1, points: 1 }).sort({ points: -1, createdAt: 1, firebaseUid: 1 }).skip(skip).limit(size).lean(),
      ReferralProfile.countDocuments(filter),
    ]);
    ranked = rows.map((r) => ({ uid: r.firebaseUid, points: r.points }));
    total = count;
  }

  const handles = await ReferralProfile.find({ firebaseUid: { $in: ranked.map((r) => r.uid) } }, { firebaseUid: 1, handle: 1 }).lean();
  const handleByUid = new Map(handles.map((h) => [h.firebaseUid, h.handle ?? null]));

  return {
    total,
    page: pageNumber,
    pageSize: size,
    ...(window ? { weekStart: window.start.toISOString(), weekEnd: window.end.toISOString() } : {}),
    rows: ranked.map((r, i) => {
      const user = byUid.get(r.uid);
      return {
        rank: skip + i + 1,
        uid: r.uid,
        name: user?.name || '',
        email: user?.email || '',
        handle: handleByUid.get(r.uid) ?? null,
        points: r.points,
      };
    }),
  };
}
