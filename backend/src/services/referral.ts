import crypto from 'crypto';
import { ReferralProfile, ReferralProfileDocument } from '../models/ReferralProfile';
import { Referral } from '../models/Referral';
import { firebaseAuth } from '../config/firebaseAdmin';
import { isDuplicateKeyError } from '../utils/mongoErrors';
import {
  NEW_ACCOUNT_WINDOW_MS,
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  REFERRAL_REDEEM_WINDOW_MS,
  REFERRED_POINTS,
  REFERRER_POINTS,
} from '../constants/referral';

// A random code from the readable alphabet. Rejection sampling (dropping bytes
// at or above the largest multiple of the alphabet size) keeps every character
// equally likely, so codes aren't biased towards the start of the alphabet.
export function generateReferralCode(): string {
  const size = REFERRAL_CODE_ALPHABET.length;
  const limit = 256 - (256 % size);
  let code = '';
  while (code.length < REFERRAL_CODE_LENGTH) {
    for (const byte of crypto.randomBytes(REFERRAL_CODE_LENGTH * 2)) {
      if (byte < limit) code += REFERRAL_CODE_ALPHABET[byte % size];
      if (code.length === REFERRAL_CODE_LENGTH) break;
    }
  }
  return code;
}

// What someone typed or pasted -> the stored form. Case, spaces and dashes
// don't matter ("abcd-2345" and "ABCD2345" are the same code).
export function normalizeReferralCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.toUpperCase().replace(/[\s-]/g, '') : '';
}

// Whether the Firebase account was created within `windowMs`. False when it
// can't be looked up, which errs on the side of NOT treating it as new.
async function accountCreatedWithin(firebaseUid: string, windowMs: number): Promise<boolean> {
  try {
    const user = await firebaseAuth.getUser(firebaseUid);
    const created = Date.parse(user.metadata.creationTime);
    return Number.isFinite(created) && Date.now() - created < windowMs;
  } catch (err) {
    console.error('[referral] could not read account creation time', err);
    return false;
  }
}

// The account's referral profile, created on first use. This is how existing
// accounts get a code: it is made the first time the app asks after this
// shipped (their next login/launch). A brand-new account additionally gets the
// "welcome" popup; an older one doesn't, since it never signed up just now.
export async function ensureReferralProfile(firebaseUid: string): Promise<ReferralProfileDocument> {
  const existing = await ReferralProfile.findOne({ firebaseUid });
  if (existing) return existing;

  const isNewAccount = await accountCreatedWithin(firebaseUid, NEW_ACCOUNT_WINDOW_MS);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await ReferralProfile.create({ firebaseUid, code: generateReferralCode(), welcomePending: isNewAccount });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // Either another request just created this account's profile (use it)
      // or the random code collided with someone else's (try another).
      const raced = await ReferralProfile.findOne({ firebaseUid });
      if (raced) return raced;
    }
  }
  throw new Error('Could not generate a unique referral code.');
}

export function toPublicReferralProfile(profile: ReferralProfileDocument) {
  return {
    code: profile.code,
    points: profile.points,
    referralCount: profile.referralCount,
    welcomePending: profile.welcomePending,
    referredBy: !!profile.referredByUid,
    rewards: { referrer: REFERRER_POINTS, referred: REFERRED_POINTS },
  };
}

export type RedeemFailure = 'invalid' | 'own' | 'already' | 'too_late';
export type RedeemResult = { redeemed: true } | { redeemed: false; reason: RedeemFailure };

export async function referralCodeExists(rawCode: unknown): Promise<boolean> {
  const code = normalizeReferralCode(rawCode);
  return !!code && !!(await ReferralProfile.exists({ code }));
}

// Uses `rawCode` for the account `firebaseUid`, paying both sides. Safe to call
// repeatedly: an account can only ever redeem one code (see models/Referral.ts).
export async function redeemReferralCode(firebaseUid: string, rawCode: unknown): Promise<RedeemResult> {
  const code = normalizeReferralCode(rawCode);
  const referrer = code ? await ReferralProfile.findOne({ code }) : null;
  if (!referrer) return { redeemed: false, reason: 'invalid' };
  if (referrer.firebaseUid === firebaseUid) return { redeemed: false, reason: 'own' };

  const me = await ensureReferralProfile(firebaseUid);
  if (me.referredByUid) return { redeemed: false, reason: 'already' };
  if (!(await accountCreatedWithin(firebaseUid, REFERRAL_REDEEM_WINDOW_MS))) return { redeemed: false, reason: 'too_late' };

  // The claim: only one request can ever create this account's Referral row.
  try {
    await Referral.create({
      referrerUid: referrer.firebaseUid,
      referredUid: firebaseUid,
      referrerPoints: REFERRER_POINTS,
      referredPoints: REFERRED_POINTS,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return { redeemed: false, reason: 'already' };
    throw err;
  }

  await Promise.all([
    ReferralProfile.updateOne({ firebaseUid }, { $set: { referredByUid: referrer.firebaseUid }, $inc: { points: REFERRED_POINTS } }),
    ReferralProfile.updateOne({ firebaseUid: referrer.firebaseUid }, { $inc: { points: REFERRER_POINTS, referralCount: 1 } }),
  ]);
  return { redeemed: true };
}
