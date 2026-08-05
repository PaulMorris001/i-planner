import fs from 'fs';
import path from 'path';
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import { env } from '../config/env';

// Apple's own root cert, downloaded from https://www.apple.com/certificateauthority/
// (Apple PKI page) and committed as a static asset — required to verify the
// certificate chain on every signed transaction locally, with no network call
// to Apple needed for the verification itself. Resolved from process.cwd()
// rather than __dirname since ts-node-dev (src/) and the compiled build
// (dist/) sit at different depths, but both run with cwd = backend/.
const APPLE_ROOT_CA_PATH = path.join(process.cwd(), 'certs', 'AppleRootCA-G3.cer');

// Lazily built on first real verification call, not at module load — so a
// backend started before APPLE_BUNDLE_ID is configured still comes up fine;
// it just can't verify Apple purchases yet (verifyAppleTransaction below
// throws a clear error instead of purchases silently no-oping).
let verifiers: { production: SignedDataVerifier; sandbox: SignedDataVerifier } | null = null;

// A JWS is signed for exactly one environment (Sandbox or Production) and a
// verifier configured for one environment rejects the other — so purchases
// from TestFlight/App Review/your own sandbox testing need their own verifier.
// Try Production first (the common case in a shipped app) and fall back to
// Sandbox, mirroring the classic verifyReceipt "try prod, retry sandbox on
// 21007" pattern.
function getVerifiers() {
  if (verifiers) return verifiers;
  if (!env.appleBundleId) {
    throw new Error('APPLE_BUNDLE_ID is not configured.');
  }
  // The library requires the numeric App Store id (App Store Connect → App
  // Information → "Apple ID" — a number, not the bundle id) for a Production
  // verifier specifically; it's genuinely optional for Sandbox only.
  if (!env.appleAppId) {
    throw new Error('APPLE_APP_ID is not configured.');
  }
  const appleRootCertificates = [fs.readFileSync(APPLE_ROOT_CA_PATH)];
  verifiers = {
    production: new SignedDataVerifier(
      appleRootCertificates,
      true,
      Environment.PRODUCTION,
      env.appleBundleId,
      env.appleAppId
    ),
    sandbox: new SignedDataVerifier(appleRootCertificates, true, Environment.SANDBOX, env.appleBundleId),
  };
  return verifiers;
}

export interface AppleVerificationResult {
  valid: boolean;
  productId?: string;
  expiresAt?: Date;
  environment?: Environment;
}

// `purchaseToken` here is what expo-iap calls the iOS purchase's unified
// token — the JWS transaction string StoreKit 2 hands back on a successful
// purchase (see PurchaseIOS.purchaseToken in the client). Verifying it
// confirms Apple actually signed this transaction and decodes the real
// productId/expiresDate from the (tamper-proof) payload, rather than trusting
// whatever the client claims those are.
export async function verifyAppleTransaction(jws: string): Promise<AppleVerificationResult> {
  const { production, sandbox } = getVerifiers();

  for (const [environment, verifier] of [
    [Environment.PRODUCTION, production],
    [Environment.SANDBOX, sandbox],
  ] as const) {
    try {
      const decoded = await verifier.verifyAndDecodeTransaction(jws);

      // revocationDate present means Apple refunded/revoked this transaction
      // (e.g. via Family Sharing removal or a support refund) — never grant
      // access for that, regardless of what expiresDate says.
      if (decoded.revocationDate) {
        return { valid: false };
      }

      const expiresAt = decoded.expiresDate ? new Date(decoded.expiresDate) : undefined;
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        return { valid: false, productId: decoded.productId, expiresAt };
      }

      return { valid: true, productId: decoded.productId, expiresAt, environment };
    } catch {
      // Wrong environment (or a genuine verification failure) — try the next
      // verifier; if both fail, the loop falls through and we report invalid.
      continue;
    }
  }

  return { valid: false };
}
