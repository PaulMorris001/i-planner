import type { SubscriptionTier } from '@/types/subscription.types';

export const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, student: 1, professional: 2, premium: 3 };

export function hasTier(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

// Mirrors backend/src/constants/featureTiers.ts — kept in sync manually, same
// as TaskCategories/TaskPriorities elsewhere (frontend and backend don't
// share a types package). Used for a client-side pre-check so tapping a
// gated feature shows UpgradeModal immediately instead of round-tripping to
// the server first; the backend enforces the same map independently, since a
// stale/bypassed client check must never be the only thing standing between
// a free user and a paid AI call.
export const FEATURE_MIN_TIER = {
  // Free-tier accessible, gated only by the existing 5/week usage cap — see
  // backend/src/constants/featureTiers.ts for why.
  coach_study: 'free',
  coach_plan: 'professional',
  coach_goal: 'professional',
  exam_topics: 'professional',
  syllabus_extraction: 'student',
} as const satisfies Record<string, SubscriptionTier>;

export const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: 'Free',
  student: 'Student / Edu',
  professional: 'Professional',
  premium: 'Premium AI',
};
