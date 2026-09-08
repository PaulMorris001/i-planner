import { AiUsage, AiUsageDocument } from '../models/AiUsage';
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

// Shared by hasQueryRemaining/consumeQuery/checkAndConsumeQuery below — loads
// this period's usage doc, resetting count to 0 first if the stored doc is
// from a previous period.
async function loadOrResetUsageDoc(firebaseUid: string, periodStart: Date): Promise<AiUsageDocument> {
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
  return doc;
}

// Read-only — checks whether the next query would be allowed, without
// consuming it. Pairs with consumeQuery below for a caller whose AI action can
// fail after this check (so consumption should only happen once real output
// actually comes back, not just because the attempt was allowed) — e.g.
// syllabus extraction. Still worth calling before the AI request itself, so
// an obviously-over-quota user doesn't cost a real API call for nothing.
export async function hasQueryRemaining(firebaseUid: string, tier: SubscriptionTier): Promise<UsageCheckResult> {
  const cap = AI_QUERY_CAPS[tier];
  const period = USAGE_PERIOD_BY_TIER[tier];
  const periodStart = currentPeriodStart(period, new Date());
  const resetsAt = nextPeriodStart(period, periodStart);
  const doc = await loadOrResetUsageDoc(firebaseUid, periodStart);
  return { allowed: doc.count < cap, cap, used: doc.count, period, resetsAt };
}

// Actually increments usage. Call only once the AI action it's paying for has
// genuinely produced output — pair with a hasQueryRemaining check beforehand
// so this doesn't run at all for an already-over-quota user. Not re-checking
// the cap here is deliberate: the caller already confirmed allowed via
// hasQueryRemaining immediately before attempting the AI call.
export async function consumeQuery(firebaseUid: string, tier: SubscriptionTier): Promise<UsageCheckResult> {
  const cap = AI_QUERY_CAPS[tier];
  const period = USAGE_PERIOD_BY_TIER[tier];
  const periodStart = currentPeriodStart(period, new Date());
  const resetsAt = nextPeriodStart(period, periodStart);
  await loadOrResetUsageDoc(firebaseUid, periodStart);
  const updated = await AiUsage.findOneAndUpdate(
    { firebaseUid, periodStart },
    { $inc: { count: 1 } },
    { new: true, upsert: true }
  );
  const used = updated?.count ?? 1;
  return { allowed: used <= cap, cap, used, period, resetsAt };
}

// Checks usage against the tier's cap and, if under it, atomically consumes one
// query, in a single step — for a caller whose AI action can't meaningfully
// fail after this point (or where charging for an attempt regardless of
// outcome is fine either way), so check-then-consume as one step is simplest.
// Not fully race-proof for simultaneous requests (period-rollover reset is
// read-then-write) — acceptable since a user sends one message at a time; worst
// case is one extra message through right at a period boundary.
export async function checkAndConsumeQuery(
  firebaseUid: string,
  tier: SubscriptionTier
): Promise<UsageCheckResult> {
  const result = await hasQueryRemaining(firebaseUid, tier);
  if (!result.allowed) return result;
  return consumeQuery(firebaseUid, tier);
}
