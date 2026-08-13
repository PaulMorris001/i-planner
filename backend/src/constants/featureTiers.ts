import type { SubscriptionTier } from '../models/Subscription';

export const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, student: 1, professional: 2, premium: 3 };

export function hasTier(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

// Minimum tier required for each AI-consuming feature — mirrored on the
// frontend in constants/featureTiers.ts (kept in sync manually, same as
// TaskCategories/TaskPriorities elsewhere in this backend, since frontend and
// backend don't share a types package). Coach chat's own message-count cap
// (AI_QUERY_CAPS in aiUsage.ts) is separate from and layered on top of this —
// this map decides whether a feature is reachable at all, the cap decides how
// many calls you get once it is.
export const FEATURE_MIN_TIER = {
  // Free-tier accessible, gated only by AI_QUERY_CAPS.free (5/week) — the
  // Plans page's feature list under Student ("AI Study Buddy") describes the
  // mode's home tier for marketing purposes, but AI_QUERY_CAPS.free's
  // existence implies free users were meant to have some Coach access, and
  // Study Buddy is the mode that makes sense as that free taste.
  coach_study: 'free',
  coach_plan: 'professional',
  coach_goal: 'professional',
  exam_topics: 'professional',
  syllabus_extraction: 'student',
} as const satisfies Record<string, SubscriptionTier>;
