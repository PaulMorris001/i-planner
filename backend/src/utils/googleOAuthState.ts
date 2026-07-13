import crypto from 'crypto';
import { env } from '../config/env';

const STATE_TTL_MS = 10 * 60 * 1000;

// Google's redirect for the Calendar OAuth callback carries no auth header, so the
// requesting user's identity has to travel in the `state` param instead. This signs
// {uid, exp} with HMAC-SHA256 so the callback can trust it without a DB round trip.
export function signState(uid: string): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + STATE_TTL_MS })).toString(
    'base64url'
  );
  const signature = crypto
    .createHmac('sha256', env.googleOAuthStateSecret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyState(state: string): string | null {
  const [payload, signature] = state.split('.');
  if (!payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', env.googleOAuthStateSecret)
    .update(payload)
    .digest('base64url');
  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof uid !== 'string' || typeof exp !== 'number' || Date.now() > exp) return null;
    return uid;
  } catch {
    return null;
  }
}
