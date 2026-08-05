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
  // When this was last confirmed directly against Apple/Google (see
  // services/appStoreVerify.ts / googlePlayVerify.ts) — set on every
  // successful POST /api/subscription/verify call, which is the only thing
  // that ever updates this document (no push notifications from either store
  // in this setup — see subscription.controller.ts for the re-verify-on-read
  // fallback for expired-looking records).
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
