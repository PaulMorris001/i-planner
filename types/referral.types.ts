// What GET /referral/me returns (backend/src/services/referral.ts).
export interface ReferralProfile {
  code: string;
  // Anonymous leaderboard name, e.g. user7k2m9qx. Empty only on an old server.
  handle: string;
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

// What GET /referral/leaderboard returns (backend/src/services/referralLeaderboard.ts).
export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  isYou: boolean;
}

export interface Leaderboard {
  weekStart: string;
  // When this week's standings reset (next Monday 00:00 UTC).
  weekEnd: string;
  top: LeaderboardEntry[];
  // rank is null while the account has no points this week.
  you: { rank: number | null; points: number };
}
