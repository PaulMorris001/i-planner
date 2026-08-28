import { Schema, model, Document } from 'mongoose';

export type SubscriptionTier = 'free' | 'student' | 'professional' | 'premium';

export interface SubscriptionDocument extends Document {
  firebaseUid: string;
  // 'free' whenever there's no active, verified purchase — there's no
  // separate "unsubscribed" status; tier itself already captures that.
  tier: SubscriptionTier;
  // The store product currently granting `tier`, and where it came from —
  // purely informational (e.g. for support/debugging), not used for gating.
  productIdentifier?: string;
  store?: 'app_store' | 'play_store';
  expiresAt?: Date;
  // Last confirmed directly against Apple/Google, set on every successful
  // POST /api/subscription/verify — the only thing that updates this doc
  // (no push notifications from either store in this setup).
  lastVerifiedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>({
  firebaseUid: { type: String, required: true, index: true, unique: true },
  tier: { type: String, enum: ['free', 'student', 'professional', 'premium'], default: 'free' },
  productIdentifier: { type: String },
  store: { type: String },
  expiresAt: { type: Date },
  lastVerifiedAt: { type: Date, default: () => new Date() },
});

export function toPublicSubscription(doc: SubscriptionDocument | null) {
  return {
    tier: doc?.tier ?? 'free',
    expiresAt: doc?.expiresAt?.toISOString() ?? null,
  };
}

export const Subscription = model<SubscriptionDocument>('Subscription', subscriptionSchema);
