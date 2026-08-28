import fs from 'fs';
import path from 'path';
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import { env } from '../config/env';

// Apple's root cert (from https://www.apple.com/certificateauthority/), committed
// as a static asset so the certificate chain verifies locally with no network call.
// Uses cwd (not __dirname) since src/ and dist/ differ in depth but both run with
// cwd = backend/.
const APPLE_ROOT_CA_PATH = path.join(process.cwd(), 'certs', 'AppleRootCA-G3.cer');

// Lazily built on first verification call, not at module load, so a backend
// started before APPLE_BUNDLE_ID is configured still comes up fine.
let verifiers: { production: SignedDataVerifier; sandbox: SignedDataVerifier } | null = null;

// A JWS is signed for exactly one environment, and a verifier for one rejects
// the other — try Production first (the common case) and fall back to Sandbox,
// mirroring the classic verifyReceipt "try prod, retry sandbox" pattern.
function getVerifiers() {
  if (verifiers) return verifiers;
  if (!env.appleBundleId) {
    throw new Error('APPLE_BUNDLE_ID is not configured.');
  }
  // Required for the Production verifier specifically (numeric App Store id,
  // not the bundle id); optional for Sandbox.
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

// `jws` is the StoreKit 2 transaction token from a successful purchase. Verifying
// confirms Apple actually signed it and decodes the real productId/expiresDate
// from the tamper-proof payload, rather than trusting the client's claims.
export async function verifyAppleTransaction(jws: string): Promise<AppleVerificationResult> {
  const { production, sandbox } = getVerifiers();

  for (const [environment, verifier] of [
    [Environment.PRODUCTION, production],
    [Environment.SANDBOX, sandbox],
  ] as const) {
    try {
      const decoded = await verifier.verifyAndDecodeTransaction(jws);

      // revocationDate means Apple refunded/revoked this transaction — never
      // grant access, regardless of expiresDate.
      if (decoded.revocationDate) {
        return { valid: false };
      }

      const expiresAt = decoded.expiresDate ? new Date(decoded.expiresDate) : undefined;
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        return { valid: false, productId: decoded.productId, expiresAt };
      }

      return { valid: true, productId: decoded.productId, expiresAt, environment };
    } catch {
      // Wrong environment or a real verification failure — try the next verifier.
      continue;
    }
  }

  return { valid: false };
}
