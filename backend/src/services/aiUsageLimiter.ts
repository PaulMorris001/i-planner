import { AiUsage } from '../models/AiUsage';
import { AI_QUERY_CAPS, USAGE_PERIOD_BY_TIER, UsagePeriod } from '../constants/aiUsage';
import type { SubscriptionTier } from '../models/Subscription';

// Monday 00:00 UTC of the current week (matches the app's Monday-start week
// convention) or the 1st of the current month 00:00 UTC.
export function currentPeriodStart(period: UsagePeriod, now: Date): Date {
  if (period === 'month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const dayOfWeek = now.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
  return monday;
}

export function nextPeriodStart(period: UsagePeriod, periodStart: Date): Date {
  if (period === 'month') {
    return new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1));
  }
  return new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export interface UsageCheckResult {
  allowed: boolean;
  cap: number;
  used: number;
  period: UsagePeriod;
  resetsAt: Date;
}

// Checks usage against the tier's cap and, if under it, atomically consumes one
// query. Not fully race-proof for simultaneous requests (period-rollover reset is
// read-then-write) — acceptable since a user sends one message at a time; worst
// case is one extra message through right at a period boundary.
export async function checkAndConsumeQuery(
  firebaseUid: string,
  tier: SubscriptionTier
): Promise<UsageCheckResult> {
  const cap = AI_QUERY_CAPS[tier];
  const period = USAGE_PERIOD_BY_TIER[tier];
  const periodStart = currentPeriodStart(period, new Date());
  const resetsAt = nextPeriodStart(period, periodStart);

  let doc = await AiUsage.findOne({ firebaseUid });
  if (!doc || doc.periodStart.getTime() !== periodStart.getTime()) {
    doc = await AiUsage.findOneAndUpdate(
      { firebaseUid },
      { $set: { periodStart, count: 0 } },
      { upsert: true, new: true }
    );
  }

  // upsert: true above guarantees doc is non-null here — mongoose's types
  // just don't narrow on that.
  if (!doc) throw new Error('Failed to load or create AiUsage record.');

  if (doc.count >= cap) {
    return { allowed: false, cap, used: doc.count, period, resetsAt };
  }

  const updated = await AiUsage.findOneAndUpdate(
    { firebaseUid, periodStart },
    { $inc: { count: 1 } },
    { new: true }
  );
  const used = updated?.count ?? doc.count + 1;
  return { allowed: true, cap, used, period, resetsAt };
}
