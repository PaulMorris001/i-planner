import { PointEvent } from '../models/PointEvent';
import { ReferralProfile } from '../models/ReferralProfile';
import { firebaseAuth } from '../config/firebaseAdmin';
import { Referral } from '../models/Referral';
import { ensureReferralEventsBackfilled } from './pointEvents';

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

// Points per account for the week, from the points record (every award, whatever
// it was for). `reachedAt` is when the account last earned points this week, i.e.
// when it reached its current total.
// Order: most points first; on a tie, whoever reached the total EARLIER ranks
// higher (so every position is unique and the podium never has two thirds); a
// tie on the exact same instant falls back to uid so the order never flips.
function standingsPipeline(start: Date, end: Date) {
  return [
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: '$firebaseUid', points: { $sum: '$points' }, reachedAt: { $max: '$createdAt' } } },
  ];
}

let topCache: { weekStart: number; at: number; top: Standing[] } | null = null;

// Called when an account is deleted, so the board stops showing it straight away.
export function invalidateLeaderboardCache(): void {
  topCache = null;
}

// Accounts whose existence was confirmed recently, so Firebase is not asked about them on every
// request. A deleted account's points are removed with it, but anything that arrives after the
// wipe (a request already in flight, the app still open on another device) can leave rows behind;
// this keeps those from ever showing on the board.
const VERIFIED_FOR_MS = 10 * 60 * 1000;
const MAX_ACCOUNTS_CHECKED = 2000;
const LOOKUP_BATCH = 100;
const verifiedAt = new Map<string, number>();

// What a deleted account leaves on the board: its points and its referral records. Kept narrow on
// purpose: this runs without the person asking, so it touches nothing else.
async function removeFromBoard(uid: string): Promise<void> {
  await Promise.all([
    PointEvent.deleteMany({ firebaseUid: uid }),
    ReferralProfile.deleteMany({ firebaseUid: uid }),
    Referral.deleteMany({ $or: [{ referrerUid: uid }, { referredUid: uid }] }),
  ]);
}

// If most of a batch looks "deleted" at once, this server is pointed at the wrong Firebase project
// (or Firebase is misbehaving) rather than half the users having deleted their accounts: do nothing.
const IMPLAUSIBLE_MISSING_RATIO = 0.5;
const MIN_BATCH_FOR_RATIO = 5;

// Removes the points of accounts that no longer exist in Firebase. Only an explicit "not found"
// counts: if Firebase can't be reached, nobody is removed.
async function dropDeletedAccounts(start: Date, end: Date): Promise<boolean> {
  const rows = await PointEvent.aggregate<{ _id: string }>([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: '$firebaseUid' } },
    { $limit: MAX_ACCOUNTS_CHECKED },
  ]);
  const now = Date.now();
  const toCheck = rows.map((r) => r._id).filter((uid) => now - (verifiedAt.get(uid) ?? 0) > VERIFIED_FOR_MS);

  let removedAny = false;
  for (let i = 0; i < toCheck.length; i += LOOKUP_BATCH) {
    const batch = toCheck.slice(i, i + LOOKUP_BATCH);
    try {
      const result = await firebaseAuth.getUsers(batch.map((uid) => ({ uid })));
      const missing = new Set(result.notFound.map((id) => (id as { uid?: string }).uid).filter(Boolean) as string[]);
      if (batch.length >= MIN_BATCH_FOR_RATIO && missing.size / batch.length > IMPLAUSIBLE_MISSING_RATIO) {
        console.error('[leaderboard] most accounts look deleted at once; skipping the clean-up (wrong Firebase project?)');
        continue;
      }
      for (const uid of batch) {
        if (missing.has(uid)) {
          await removeFromBoard(uid);
          verifiedAt.delete(uid);
          removedAny = true;
        } else {
          verifiedAt.set(uid, now);
        }
      }
    } catch (err) {
      console.error('[leaderboard] could not check accounts, skipping the clean-up this time', err);
    }
  }
  return removedAny;
}

async function topStandings(start: Date, end: Date): Promise<Standing[]> {
  if (topCache && topCache.weekStart === start.getTime() && Date.now() - topCache.at < CACHE_MS) return topCache.top;
  const rows = await PointEvent.aggregate<{ _id: string; points: number }>([
    ...standingsPipeline(start, end),
    { $sort: { points: -1, reachedAt: 1, _id: 1 } },
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
  await ensureReferralEventsBackfilled();
  const { start, end } = weekBounds(now);
  if (await dropDeletedAccounts(start, end)) invalidateLeaderboardCache();
  const top = await topStandings(start, end);

  const mine = await PointEvent.aggregate<{ _id: string; points: number; reachedAt: Date }>([
    ...standingsPipeline(start, end),
    { $match: { _id: uid } },
  ]);
  const myPoints = mine[0]?.points ?? 0;
  let myRank: number | null = null;
  if (myPoints > 0) {
    const ahead = await PointEvent.aggregate<{ n: number }>([
      ...standingsPipeline(start, end),
      {
        $match: {
          $or: [
            { points: { $gt: myPoints } },
            { points: myPoints, reachedAt: { $lt: mine[0].reachedAt } },
            { points: myPoints, reachedAt: mine[0].reachedAt, _id: { $lt: uid } },
          ],
        },
      },
      { $count: 'n' },
    ]);
    myRank = (ahead[0]?.n ?? 0) + 1;
  }

  const names = await namesFor(top.map((t) => t.uid));
  // Ranks are positions: unique, so no two people share one.
  const entries = top.map((t, index) => ({
    rank: index + 1,
    name: names.get(t.uid) ?? 'user',
    points: t.points,
    isYou: t.uid === uid,
  }));

  return { weekStart: start.toISOString(), weekEnd: end.toISOString(), top: entries, you: { rank: myRank, points: myPoints } };
}
