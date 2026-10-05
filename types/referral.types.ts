// What GET /referral/me returns (backend/src/services/referral.ts).
export interface ReferralProfile {
  code: string;
  points: number;
  // How many people signed up with this account's code.
  referralCount: number;
  // A brand-new sign-up that hasn't seen the "here's your code" popup yet.
  welcomePending: boolean;
  // This account signed up with someone's code (and got the bonus for it).
  referredBy: boolean;
  // Points per referral, so the app's wording always matches the server.
  rewards: { referrer: number; referred: number };
}

export type ReferralRedeemFailure = 'invalid' | 'own' | 'already' | 'too_late';

export interface ReferralSignUpResult extends ReferralProfile {
  redeem: { redeemed: true } | { redeemed: false; reason: ReferralRedeemFailure } | null;
}
