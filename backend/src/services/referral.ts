import crypto from 'crypto';
import { ReferralProfile, ReferralProfileDocument } from '../models/ReferralProfile';
import { Referral, ReferralDocument } from '../models/Referral';
import { firebaseAuth } from '../config/firebaseAdmin';
import { isDuplicateKeyError } from '../utils/mongoErrors';
import { recordPointEvent } from './pointEvents';
import {
  NEW_ACCOUNT_WINDOW_MS,
  REFERRAL_CODE_ALPHABET,
  HANDLE_ALPHABET,
  HANDLE_PREFIX,
  HANDLE_RANDOM_LENGTH,
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

// "user" + 7 random characters, every character equally likely (same rejection
// sampling as the referral code).
export function generateHandle(): string {
  const size = HANDLE_ALPHABET.length;
  const limit = 256 - (256 % size);
  let random = '';
  while (random.length < HANDLE_RANDOM_LENGTH) {
    for (const byte of crypto.randomBytes(HANDLE_RANDOM_LENGTH * 2)) {
      if (byte < limit) random += HANDLE_ALPHABET[byte % size];
      if (random.length === HANDLE_RANDOM_LENGTH) break;
    }
  }
  return HANDLE_PREFIX + random;
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
  if (existing) return existing.handle ? existing : assignHandle(existing);

  const isNewAccount = await accountCreatedWithin(firebaseUid, NEW_ACCOUNT_WINDOW_MS);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await ReferralProfile.create({ firebaseUid, code: generateReferralCode(), handle: generateHandle(), welcomePending: isNewAccount });
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

// Gives a profile that predates leaderboard names its handle. The update only
// matches while the profile still has none, so two requests can't set it twice.
async function assignHandle(profile: ReferralProfileDocument): Promise<ReferralProfileDocument> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const updated = await ReferralProfile.findOneAndUpdate(
        { firebaseUid: profile.firebaseUid, handle: { $exists: false } },
        { $set: { handle: generateHandle() } },
        { new: true }
      );
      if (updated) return updated;
      // Lost the race to a concurrent request: it already set one.
      return (await ReferralProfile.findOne({ firebaseUid: profile.firebaseUid })) ?? profile;
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // The random handle collided with someone else's: try another.
    }
  }
  return profile;
}

export function toPublicReferralProfile(profile: ReferralProfileDocument) {
  return {
    code: profile.code,
    handle: profile.handle ?? '',
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
  let claim: ReferralDocument;
  try {
    claim = await Referral.create({
      referrerUid: referrer.firebaseUid,
      referredUid: firebaseUid,
      referrerPoints: REFERRER_POINTS,
      referredPoints: REFERRED_POINTS,
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    // A claim already exists (a repeat, or a request that was cut off after
    // claiming): finish paying whatever side is still unpaid, never twice.
    const existing = await Referral.findOne({ referredUid: firebaseUid });
    if (existing) await payReferral(existing);
    return { redeemed: false, reason: 'already' };
  }

  await payReferral(claim);
  return { redeemed: true };
}

// Pays each side of a claim at most once. A side's paid flag is flipped first, in
// one atomic update that only matches while it is still false; only the request
// that wins that flip adds the points, so concurrent or repeated calls can't
// double-pay. (A crash between the flip and the add loses that side's points
// rather than ever duplicating them.)
async function payReferral(claim: ReferralDocument): Promise<void> {
  const [referredWon, referrerWon] = await Promise.all([
    Referral.updateOne({ _id: claim._id, referredPaid: false }, { $set: { referredPaid: true } }),
    Referral.updateOne({ _id: claim._id, referrerPaid: false }, { $set: { referrerPaid: true } }),
  ]);
  await Promise.all([
    referredWon.modifiedCount === 1
      ? recordPointEvent(claim.referredUid, `referral:referred:${claim.referredUid}`, 'referral', claim.referredPoints)
      : undefined,
    referrerWon.modifiedCount === 1
      ? recordPointEvent(claim.referrerUid, `referral:referrer:${claim.referredUid}`, 'referral', claim.referrerPoints)
      : undefined,
  ]);
  await Promise.all([
    referredWon.modifiedCount === 1
      ? ReferralProfile.updateOne(
          { firebaseUid: claim.referredUid },
          { $set: { referredByUid: claim.referrerUid }, $inc: { points: claim.referredPoints } }
        )
      : undefined,
    referrerWon.modifiedCount === 1
      ? ReferralProfile.updateOne({ firebaseUid: claim.referrerUid }, { $inc: { points: claim.referrerPoints, referralCount: 1 } })
      : undefined,
  ]);
}
