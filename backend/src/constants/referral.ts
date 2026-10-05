// Points earned for a referral. Both sides are rewarded when a new account signs
// up with a code. The app reads these from the API (GET /referral/me), so
// changing them here updates the wording in the app with no app release.
export const REFERRER_POINTS = 100; // the person whose code was used
export const REFERRED_POINTS = 50; // the new account that used it

// 8 characters from an alphabet without 0/O, 1/I/L, so a code read aloud or
// copied off a screenshot can't be mistyped. 31^8 is about 850 billion codes.
export const REFERRAL_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const REFERRAL_CODE_LENGTH = 8;

// The anonymous name shown on the weekly leaderboard: "user" + 7 random characters,
// e.g. user7k2m9qx. No vowels (so the random part can't spell a word) and no 0/1/l/o
// lookalikes. Assigned once per account and never changes.
export const HANDLE_PREFIX = 'user';
export const HANDLE_ALPHABET = '23456789bcdfghjkmnpqrstvwxz';
export const HANDLE_RANDOM_LENGTH = 7;

// A code can only be entered by a NEW account: it has to be redeemed within this
// long of the account being created. Stops an old account from collecting points
// by entering a code later.
export const REFERRAL_REDEEM_WINDOW_MS = 48 * 60 * 60 * 1000;

// An account created this recently when its referral profile is first made counts
// as a brand-new sign-up (it sees the welcome code popup). Older accounts, which
// just got a code on their next login, don't.
export const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;
