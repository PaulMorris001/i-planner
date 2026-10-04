import { Response } from 'express';
import { Subscription, toPublicSubscription, SubscriptionTier } from '../models/Subscription';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { verifyAppleTransaction } from '../services/appStoreVerify';
import { verifyGooglePurchase } from '../services/googlePlayVerify';
import { firebaseAuth } from '../config/firebaseAdmin';
import { sendEmail } from '../utils/email';
import { buildUpgradeEmailHtml } from '../services/authEmailHtml';

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

// A changed subscription deserves a welcome email; a re-check of the same one
// doesn't. This endpoint also runs on every app launch and on Restore, and
// for each renewal, all of which re-verify an unchanged product.
function isNewSubscription(
  previous: { productIdentifier?: string; expiresAt?: Date } | null,
  productId: string
): boolean {
  if (!previous || previous.productIdentifier !== productId) return true; // first purchase, upgrade, or switch
  // Same product, but the old one had lapsed -- they've re-subscribed.
  return !!previous.expiresAt && previous.expiresAt.getTime() < Date.now();
}

function billingFromProductId(productId: string): 'Monthly' | 'Annual' | undefined {
  if (productId.includes('annual') || productId.includes('year')) return 'Annual';
  if (productId.includes('month')) return 'Monthly';
  return undefined;
}

// Best-effort, after the response -- an email problem must never fail or slow
// down the purchase itself.
async function sendUpgradeEmail(
  firebaseUid: string,
  email: string,
  details: { tier: SubscriptionTier; productId: string; expiresAt?: Date; store: 'app_store' | 'play_store' }
) {
  if (details.tier === 'free') return;
  try {
    const user = await firebaseAuth.getUser(firebaseUid).catch(() => null);
    const { subject, html, text } = buildUpgradeEmailHtml({
      fullName: user?.displayName ?? undefined,
      tier: details.tier,
      billing: billingFromProductId(details.productId),
      renewsAt: details.expiresAt,
      store: details.store,
    });
    await sendEmail({ to: email, subject, html, text });
  } catch (err) {
    console.error('[subscription] failed to send upgrade email', err);
  }
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

  const tier = tierFromProductId(result.productId);
  const store = platform === 'ios' ? 'app_store' : 'play_store';
  // new: false hands back the document as it was BEFORE this update, in the
  // same atomic step -- so if a purchase and a launch-time re-check race, only
  // the one that actually changed the product sees a change and emails.
  const previous = await Subscription.findOneAndUpdate(
    { firebaseUid: req.userId },
    {
      $set: {
        tier,
        productIdentifier: result.productId,
        store,
        expiresAt: result.expiresAt,
        lastVerifiedAt: new Date(),
      },
    },
    { upsert: true, new: false }
  );
  const subscription = await Subscription.findOne({ firebaseUid: req.userId });

  res.json(toPublicSubscription(subscription));

  if (req.userEmail && isNewSubscription(previous, result.productId)) {
    void sendUpgradeEmail(req.userId!, req.userEmail, { tier, productId: result.productId, expiresAt: result.expiresAt, store });
  }
}
