import { Referral } from '../models/Referral';
import { ReferralProfile } from '../models/ReferralProfile';

export const LEADERBOARD_SIZE = 10;
const CACHE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// The leaderboard week runs Monday 00:00 UTC to the next Monday 00:00 UTC. Nothing
// is stored or reset: a week's standings are worked out from the referrals made
// inside its window, so a new week simply starts with an empty window.
export function weekBounds(now: number = Date.now()): { start: Date; end: Date } {
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const sinceMonday = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const start = midnight - sinceMonday * DAY_MS;
  return { start: new Date(start), end: new Date(start + 7 * DAY_MS) };
}

interface Standing {
  uid: string;
  points: number;
}

// Points per account for the week: each referral pays its referrer and its
// referred account, so one row counts for two people. Highest first, ties broken
// by uid so the order never flips between requests.
function standingsPipeline(start: Date, end: Date) {
  return [
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $project: {
        entries: [
          { uid: '$referrerUid', points: '$referrerPoints' },
          { uid: '$referredUid', points: '$referredPoints' },
        ],
      },
    },
    { $unwind: '$entries' },
    { $group: { _id: '$entries.uid', points: { $sum: '$entries.points' } } },
  ];
}

let topCache: { weekStart: number; at: number; top: Standing[] } | null = null;

async function topStandings(start: Date, end: Date): Promise<Standing[]> {
  if (topCache && topCache.weekStart === start.getTime() && Date.now() - topCache.at < CACHE_MS) return topCache.top;
  const rows = await Referral.aggregate<{ _id: string; points: number }>([
    ...standingsPipeline(start, end),
    { $sort: { points: -1, _id: 1 } },
    { $limit: LEADERBOARD_SIZE },
  ]);
  const top = rows.map((r) => ({ uid: r._id, points: r.points }));
  topCache = { weekStart: start.getTime(), at: Date.now(), top };
  return top;
}

// Only the anonymous handle is ever shown: real names never leave the account.
async function namesFor(uids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!uids.length) return names;
  const profiles = await ReferralProfile.find({ firebaseUid: { $in: uids } }, { firebaseUid: 1, handle: 1 }).lean();
  for (const p of profiles) if (p.handle) names.set(p.firebaseUid, p.handle);
  return names;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  isYou: boolean;
}

export interface Leaderboard {
  weekStart: string;
  weekEnd: string;
  top: LeaderboardEntry[];
  // null points/rank: nothing earned yet this week, so not on the board.
  you: { rank: number | null; points: number };
}

export async function getLeaderboard(uid: string, now: number = Date.now()): Promise<Leaderboard> {
  const { start, end } = weekBounds(now);
  const top = await topStandings(start, end);

  const mine = await Referral.aggregate<{ _id: string; points: number }>([
    ...standingsPipeline(start, end),
    { $match: { _id: uid } },
  ]);
  const myPoints = mine[0]?.points ?? 0;
  let myRank: number | null = null;
  if (myPoints > 0) {
    const ahead = await Referral.aggregate<{ n: number }>([
      ...standingsPipeline(start, end),
      { $match: { points: { $gt: myPoints } } },
      { $count: 'n' },
    ]);
    myRank = (ahead[0]?.n ?? 0) + 1; // ties share a rank
  }

  const names = await namesFor(top.map((t) => t.uid));
  // Ties share a rank, same as "you" above.
  let previous: Standing | null = null;
  let previousRank = 0;
  const entries = top.map((t, index) => {
    const rank = previous && previous.points === t.points ? previousRank : index + 1;
    previous = t;
    previousRank = rank;
    return { rank, name: names.get(t.uid) ?? 'user', points: t.points, isYou: t.uid === uid };
  });

  return { weekStart: start.toISOString(), weekEnd: end.toISOString(), top: entries, you: { rank: myRank, points: myPoints } };
}
