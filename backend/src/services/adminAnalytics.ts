import { AccountSuspension } from '../models/AccountSuspension';
import { UserPresence } from '../models/UserPresence';
import { PushToken } from '../models/PushToken';
import { Subscription } from '../models/Subscription';
import { getDirectory } from './adminUsers';

const DAY_MS = 24 * 60 * 60 * 1000;
// "Active now": made a request in the last five minutes. The app does not keep a live connection,
// so this is the closest honest meaning of "currently logged in".
export const ACTIVE_NOW_WINDOW_MS = 5 * 60 * 1000;
const SIGNUP_DAYS = 14;

export interface AdminAnalytics {
  generatedAt: string;
  users: { total: number; newLast7Days: number; newLast30Days: number; suspended: number };
  activity: { activeNow: number; last24Hours: number; last7Days: number };
  plans: { free: number; student: number; professional: number; premium: number; paid: number; comped: number };
  // Accounts with at least one signed-in device that can receive notifications, per platform.
  // This is NOT store downloads: the App Store and Google Play only share download counts through
  // their own reporting tools, not through anything this app can read.
  devices: { ios: number; android: number; noDevice: number };
  signupsByDay: { date: string; count: number }[];
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function getAnalytics(now: number = Date.now()): Promise<AdminAnalytics> {
  const directory = await getDirectory();
  const total = directory.length;

  const [suspended, activeNow, last24h, last7d, subRows, deviceRows] = await Promise.all([
    AccountSuspension.countDocuments(),
    UserPresence.countDocuments({ lastActiveAt: { $gte: new Date(now - ACTIVE_NOW_WINDOW_MS) } }),
    UserPresence.countDocuments({ lastActiveAt: { $gte: new Date(now - DAY_MS) } }),
    UserPresence.countDocuments({ lastActiveAt: { $gte: new Date(now - 7 * DAY_MS) } }),
    Subscription.find({ tier: { $ne: 'free' } }, { firebaseUid: 1, tier: 1, expiresAt: 1, comped: 1 }).lean(),
    PushToken.aggregate<{ _id: 'ios' | 'android'; uids: string[] }>([
      { $group: { _id: '$platform', uids: { $addToSet: '$firebaseUid' } } },
    ]),
  ]);

  // Only plans that are still in force count as paid; an expired one is back on the free plan.
  const existing = new Set(directory.map((u) => u.uid));
  const plans = { free: 0, student: 0, professional: 0, premium: 0, paid: 0, comped: 0 };
  for (const row of subRows) {
    if (!existing.has(row.firebaseUid)) continue; // data left behind by a deleted account
    if (row.expiresAt && row.expiresAt.getTime() <= now) continue;
    plans[row.tier as 'student' | 'professional' | 'premium']++;
    plans.paid++;
    if (row.comped) plans.comped++;
  }
  plans.free = Math.max(0, total - plans.paid);

  const deviceUids = { ios: new Set<string>(), android: new Set<string>() };
  for (const row of deviceRows) {
    if (row._id === 'ios' || row._id === 'android') row.uids.forEach((uid) => existing.has(uid) && deviceUids[row._id].add(uid));
  }
  const anyDevice = new Set([...deviceUids.ios, ...deviceUids.android]);

  const signups = new Map<string, number>();
  for (let i = SIGNUP_DAYS - 1; i >= 0; i--) signups.set(dayKey(now - i * DAY_MS), 0);
  let newLast7 = 0;
  let newLast30 = 0;
  for (const u of directory) {
    const age = now - u.createdAt;
    if (age <= 7 * DAY_MS) newLast7++;
    if (age <= 30 * DAY_MS) newLast30++;
    const key = dayKey(u.createdAt);
    if (signups.has(key)) signups.set(key, (signups.get(key) ?? 0) + 1);
  }

  return {
    generatedAt: new Date(now).toISOString(),
    users: { total, newLast7Days: newLast7, newLast30Days: newLast30, suspended },
    activity: { activeNow, last24Hours: last24h, last7Days: last7d },
    plans,
    devices: { ios: deviceUids.ios.size, android: deviceUids.android.size, noDevice: Math.max(0, total - anyDevice.size) },
    signupsByDay: [...signups.entries()].map(([date, count]) => ({ date, count })),
  };
}
