import { google } from 'googleapis';
import { env } from '../config/env';

// Subscription states that mean "the user currently has access." Grace period
// still grants access (a short window to fix a failed card); on-hold does not.
const ACTIVE_STATES = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD']);

// Built lazily so a backend started before Play Console credentials are
// configured still comes up fine (same as appStoreVerify.ts).
let androidPublisher: ReturnType<typeof google.androidpublisher> | null = null;

function getAndroidPublisher() {
  if (androidPublisher) return androidPublisher;
  if (!env.googlePlayServiceAccountJson) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured.');
  }
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(env.googlePlayServiceAccountJson),
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  androidPublisher = google.androidpublisher({ version: 'v3', auth });
  return androidPublisher;
}

export interface GoogleVerificationResult {
  valid: boolean;
  productId?: string;
  expiresAt?: Date;
}

// Looking up purchaseToken via the Play Developer API confirms Google actually
// issued it and returns the real subscription state, not the client's claims.
export async function verifyGooglePurchase(purchaseToken: string): Promise<GoogleVerificationResult> {
  if (!env.googlePlayPackageName) {
    throw new Error('GOOGLE_PLAY_PACKAGE_NAME is not configured.');
  }

  const res = await getAndroidPublisher().purchases.subscriptionsv2.get({
    packageName: env.googlePlayPackageName,
    token: purchaseToken,
  });

  const subscription = res.data;
  if (!subscription.subscriptionState || !ACTIVE_STATES.has(subscription.subscriptionState)) {
    return { valid: false };
  }

  // A purchase token can cover more than one line item after a plan change;
  // the most recent expiry across all of them is the one that matters.
  const lineItems = subscription.lineItems ?? [];
  const productId = lineItems[0]?.productId ?? undefined;
  const expiryTimes = lineItems.map((item) => (item.expiryTime ? new Date(item.expiryTime) : null)).filter((d): d is Date => !!d);
  const expiresAt = expiryTimes.length ? new Date(Math.max(...expiryTimes.map((d) => d.getTime()))) : undefined;

  return { valid: true, productId, expiresAt };
}
