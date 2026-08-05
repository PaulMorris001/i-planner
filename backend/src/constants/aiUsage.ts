import type { SubscriptionTier } from '../models/Subscription';

// AI Coach query caps, per the shareholder pricing strategy doc. Flat across
// every region — regional/tiered subscription *prices* are configured
// per-territory directly in App Store Connect / Play Console (same product
// id, different shelf price), but usage caps don't vary by region.
export const AI_QUERY_CAPS: Record<SubscriptionTier, number> = {
  free: 5,
  student: 50,
  professional: 150,
  premium: 1000,
};

// Free resets weekly (Monday, matching the app's Monday-start week convention
// used elsewhere — see utils/date.ts's weekdayIndexMonday); every paid tier
// resets on the calendar month.
export type UsagePeriod = 'week' | 'month';

export const USAGE_PERIOD_BY_TIER: Record<SubscriptionTier, UsagePeriod> = {
  free: 'week',
  student: 'month',
  professional: 'month',
  premium: 'month',
};
