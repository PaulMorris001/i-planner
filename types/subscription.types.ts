export type SubscriptionTier = 'free' | 'student' | 'professional' | 'premium';

export interface Subscription {
  tier: SubscriptionTier;
  expiresAt: string | null;
}
