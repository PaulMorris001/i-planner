import { Request, Response } from 'express';
import { ReferralProfile } from '../models/ReferralProfile';
import { AuthedRequest } from '../middleware/requireAuth';
import {
  ensureReferralProfile,
  redeemReferralCode,
  referralCodeExists,
  toPublicReferralProfile,
} from '../services/referral';

// Public (no sign-in), because the sign-up screen checks a code BEFORE the
// account exists, so a typo can be fixed rather than silently dropped. Reveals
// only whether the code is real, never whose it is, and is rate limited.
const VALIDATE_LIMIT = 30;
const VALIDATE_WINDOW_MS = 10 * 60 * 1000;
const validateHits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.ip || 'unknown';
}

export async function validateReferralCode(req: Request, res: Response) {
  const ip = clientIp(req);
  const now = Date.now();
  const hit = validateHits.get(ip);
  if (!hit || hit.resetAt <= now) {
    validateHits.set(ip, { count: 1, resetAt: now + VALIDATE_WINDOW_MS });
  } else if (++hit.count > VALIDATE_LIMIT) {
    res.status(429).json({ message: 'Too many attempts. Try again in a few minutes.', field: 'general' });
    return;
  }
  // Keeps the table from growing forever.
  if (validateHits.size > 5000) for (const [key, value] of validateHits) if (value.resetAt <= now) validateHits.delete(key);

  res.json({ valid: await referralCodeExists(req.params.code) });
}

// The account's code and points. Also what gives an existing account its code on
// its next login: the profile is created here on first request.
export async function getMyReferral(req: AuthedRequest, res: Response) {
  const profile = await ensureReferralProfile(req.userId!);
  res.json(toPublicReferralProfile(profile));
}

// Called once right after sign-up, with the optional code the person entered.
export async function signUpReferral(req: AuthedRequest, res: Response) {
  const profile = await ensureReferralProfile(req.userId!);
  const code = req.body?.referralCode;
  const result = code ? await redeemReferralCode(req.userId!, code) : null;
  // Read again: a successful redemption just changed the points.
  const fresh = (await ReferralProfile.findOne({ firebaseUid: req.userId })) ?? profile;
  res.json({ ...toPublicReferralProfile(fresh), redeem: result });
}

export async function markWelcomeSeen(req: AuthedRequest, res: Response) {
  const profile = await ReferralProfile.findOneAndUpdate(
    { firebaseUid: req.userId },
    { $set: { welcomePending: false } },
    { new: true }
  );
  res.json(toPublicReferralProfile(profile ?? (await ensureReferralProfile(req.userId!))));
}
