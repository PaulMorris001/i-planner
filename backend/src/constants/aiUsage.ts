import type { SubscriptionTier } from '../models/Subscription';

// AI Coach query caps. Flat across regions — subscription prices vary by territory
// in App Store Connect / Play Console, but usage caps don't.
export const AI_QUERY_CAPS: Record<SubscriptionTier, number> = {
  free: 5,
  student: 50,
  professional: 150,
  premium: 1000,
};

// Free resets weekly (Monday-start, per utils/date.ts's weekdayIndexMonday); paid
// tiers reset monthly.
export type UsagePeriod = 'week' | 'month';

export const USAGE_PERIOD_BY_TIER: Record<SubscriptionTier, UsagePeriod> = {
  free: 'week',
  student: 'month',
  professional: 'month',
  premium: 'month',
};
