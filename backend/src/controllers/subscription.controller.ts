import { Response } from 'express';
import { Subscription, toPublicSubscription, SubscriptionTier } from '../models/Subscription';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { verifyAppleTransaction } from '../services/appStoreVerify';
import { verifyGooglePurchase } from '../services/googlePlayVerify';

// The client's on-device purchase state is fine for immediate UI feedback but not
// for gating (a modified client could fake it) — this doc, updated only by
// verifySubscription confirming with Apple/Google directly, is the source of truth.
export async function getSubscription(req: AuthedRequest, res: Response) {
  const subscription = await Subscription.findOne({ firebaseUid: req.userId });
  res.json(toPublicSubscription(subscription));
}

// Matched by substring, not exact-match table, so naming differences between
// what's typed into App Store Connect/Play Console and this list don't break gating.
function tierFromProductId(productId: string): SubscriptionTier {
  if (productId.includes('premium')) return 'premium';
  if (productId.includes('professional')) return 'professional';
  if (productId.includes('student')) return 'student';
  return 'free';
}

// Verifies the store token directly against Apple/Google before updating the
// stored tier — the client never gets to just assert "I'm premium now."
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
