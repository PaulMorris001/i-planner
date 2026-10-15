// Shared referral links: https://api.i-plannerapp.com/r/<CODE>.
//
//  - App installed: the phone opens the app straight to that path (Universal Links / App Links),
//    and the sign-up screen is filled in with the code.
//  - App not installed: the link opens a web page that sends the person to the right store. On
//    Android the code travels through the Play Store (the "install referrer") and is picked up on
//    first launch; on iPhone the page shows the code to type in.

// Same alphabet and length as the server's codes (backend constants/referral.ts): no 0/O, 1/I/L.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.i-plannerapp.com/api';
// The link lives on the same host as the API, without the "/api" part.
export const LINK_BASE_URL = API_URL.replace(/\/+$/, '').replace(/\/api$/, '');

// "abcd 2345" / "ABCD-2345" -> "ABCD2345".
export function normalizeReferralCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.toUpperCase().replace(/[\s-]/g, '') : '';
}

export function isWellFormedReferralCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));
}

export function buildReferralLink(code: string): string {
  return `${LINK_BASE_URL}/r/${normalizeReferralCode(code)}`;
}

// The message that goes out with the share button: friendly, with the plain code too, so it still
// works for someone whose app can't open the link.
export function referralShareMessage(code: string): string {
  const clean = normalizeReferralCode(code);
  return `Join me on i-Planner! Sign up with my referral code ${clean} and we both earn points.\n${buildReferralLink(clean)}`;
}

// What Google Play hands the app after an install that started from a shared link: the "referrer"
// string we put on the store URL ("ref=ABCD2345"), possibly alongside other parameters.
export function referralCodeFromInstallReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  for (const part of referrer.split('&')) {
    const [key, value] = part.split('=');
    if (key === 'ref') {
      let decoded = value ?? '';
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        // Malformed percent-encoding: use the text as it is, which then fails the code check.
      }
      const code = normalizeReferralCode(decoded);
      if (isWellFormedReferralCode(code)) return code;
    }
  }
  return null;
}

// Which code the sign-up form starts with: the one in the link that opened it, else one remembered
// from an earlier link / the Play Store. Anything that is not a well-formed code is ignored.
export function pickInviteCode(fromLink: unknown, stored: unknown): string {
  const linked = normalizeReferralCode(fromLink);
  if (isWellFormedReferralCode(linked)) return linked;
  const remembered = normalizeReferralCode(stored);
  return isWellFormedReferralCode(remembered) ? remembered : '';
}
