import { Response } from 'express';
import { Subscription, toPublicSubscription, SubscriptionTier } from '../models/Subscription';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { verifyAppleTransaction } from '../services/appStoreVerify';
import { verifyGooglePurchase } from '../services/googlePlayVerify';

// The client's own on-device purchase state is convenient for immediate UI
// feedback right after a purchase, but isn't what feature-gating should trust
// — a modified client could fake it. This document is the real source of
// truth, only ever updated by verifySubscription below actually confirming a
// purchase with Apple/Google directly.
export async function getSubscription(req: AuthedRequest, res: Response) {
  const subscription = await Subscription.findOne({ firebaseUid: req.userId });
  res.json(toPublicSubscription(subscription));
}

// Tier names are deliberately baked into the product id (see app/plans.tsx's
// TIERS array — e.g. "student_monthly", "com.obitoventures.iplanner.premium.annual")
// rather than keyed off an exact-match table, so small naming differences
// between what's actually typed into App Store Connect/Play Console and this
// list don't silently break gating.
function tierFromProductId(productId: string): SubscriptionTier {
  if (productId.includes('premium')) return 'premium';
  if (productId.includes('professional')) return 'professional';
  if (productId.includes('student')) return 'student';
  return 'free';
}

// Called right after a client-side purchase (or during restore/reconciliation
// — see contexts/PurchasesContext.tsx) with the raw token the store handed
// the device. Verifies it directly against Apple/Google using this backend's
// own credentials, and only then updates the stored tier — the client never
// gets to just assert "I'm premium now."
export async function verifySubscription(req: AuthedRequest, res: Response) {
  const { platform, purchaseToken } = req.body ?? {};

  if (platform !== 'ios' && platform !== 'android') {
    throw new ApiError(400, 'platform must be "ios" or "android".', 'general');
  }
  if (typeof purchaseToken !== 'string' || !purchaseToken) {
    throw new ApiError(400, 'purchaseToken is required.', 'general');
  }

  const result =
    platform === 'ios' ? await verifyAppleTransaction(purchaseToken) : await verifyGooglePurchase(purchaseToken);

  if (!result.valid || !result.productId) {
    throw new ApiError(400, "This purchase couldn't be verified.", 'general');
  }

  const subscription = await Subscription.findOneAndUpdate(
    { firebaseUid: req.userId },
    {
      $set: {
        tier: tierFromProductId(result.productId),
        productIdentifier: result.productId,
        store: platform === 'ios' ? 'app_store' : 'play_store',
        expiresAt: result.expiresAt,
        lastVerifiedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  res.json(toPublicSubscription(subscription));
}
