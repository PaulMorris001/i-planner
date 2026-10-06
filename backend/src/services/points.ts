import { ReferralProfile } from '../models/ReferralProfile';
import { ensureReferralProfile } from './referral';
import { recordPointEvent } from './pointEvents';
import { MIN_ITEM_AGE_MS } from '../constants/points';

const DAY_MS = 24 * 60 * 60 * 1000;

// Pays `points` for the thing identified by `key`, at most once ever. The record is
// created first and only the request that created it adds the points to the total,
// so repeated or simultaneous calls can't pay twice. (A crash between the two steps
// loses those points rather than ever duplicating them.)
export async function awardPoints(firebaseUid: string, key: string, type: string, points: number): Promise<boolean> {
  if (!(await recordPointEvent(firebaseUid, key, type, points))) return false;
  await ensureReferralProfile(firebaseUid);
  await ReferralProfile.updateOne({ firebaseUid }, { $inc: { points } });
  return true;
}

// Points are a bonus: a failure here must never fail the request that triggered
// it (completing a task has to work even if awarding hits an error).
export async function awardPointsSafely(firebaseUid: string, key: string, type: string, points: number): Promise<void> {
  try {
    await awardPoints(firebaseUid, key, type, points);
  } catch (err) {
    console.error('[points] could not award points', { key, err });
  }
}

// Documents have no createdAt of their own, but a Mongo _id starts with its
// creation time.
export function isOldEnoughForPoints(doc: { _id: unknown }, now: number = Date.now()): boolean {
  const id = doc._id as { getTimestamp?: () => Date } | undefined;
  const created = id?.getTimestamp?.().getTime();
  return created !== undefined && now - created >= MIN_ITEM_AGE_MS;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// A "YYYY-MM-DD" sent by the app counts only if it is within a day of the
// server's date (the app's local day can differ from UTC by up to ~14 hours).
// Without this, a request could claim a different past or future date each time
// to collect points over and over.
export function isPlausibleToday(dateKey: unknown, now: number = Date.now()): dateKey is string {
  if (typeof dateKey !== 'string' || !DATE_KEY_RE.test(dateKey)) return false;
  const day = Date.parse(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(day)) return false;
  const todayStart = Math.floor(now / DAY_MS) * DAY_MS;
  return Math.abs(day - todayStart) <= DAY_MS;
}

export function utcDateKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

// A bill cycle (its due date, "YYYY-MM-DD") has to be a real date within about six
// weeks of today, so a made-up cycle can't be used to collect points.
export function isCycleNearToday(cycle: string, now: number = Date.now()): boolean {
  if (!DATE_KEY_RE.test(cycle)) return false;
  const day = Date.parse(`${cycle}T00:00:00Z`);
  return Number.isFinite(day) && Math.abs(day - now) <= 45 * DAY_MS;
}

// Paid on or before the due date. A day of slack covers the app's local day being
// behind UTC.
export function isPaidOnTime(cycle: string, now: number = Date.now()): boolean {
  const due = Date.parse(`${cycle}T00:00:00Z`);
  const todayStart = Math.floor(now / DAY_MS) * DAY_MS;
  return Number.isFinite(due) && todayStart <= due + DAY_MS;
}
