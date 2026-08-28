import type { SubscriptionTier } from '../models/Subscription';

export const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, student: 1, professional: 2, premium: 3 };

export function hasTier(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

// Minimum tier per AI-consuming feature — mirrored manually on the frontend
// (constants/featureTiers.ts; no shared types package). Separate from and layered
// under AI_QUERY_CAPS (aiUsage.ts): this decides if a feature is reachable at all,
// the cap decides how many calls once it is.
export const FEATURE_MIN_TIER = {
  // Free-tier accessible, gated only by AI_QUERY_CAPS.free (5/week) — the free
  // taste of Coach access despite Plans marketing "AI Study Buddy" under Student.
  coach_study: 'free',
  coach_plan: 'professional',
  coach_goal: 'professional',
  exam_topics: 'professional',
  syllabus_extraction: 'student',
} as const satisfies Record<string, SubscriptionTier>;
