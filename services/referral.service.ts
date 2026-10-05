import type { Leaderboard, ReferralProfile, ReferralSignUpResult } from "@/types/referral.types";
import { apiRequest } from "./api";
import { authedRequest } from "./authedRequest";

export const referralService = {
  // The signed-in account's code and points. Also what gives an account that
  // existed before referrals its code: the server creates it on first request.
  me: () => authedRequest<ReferralProfile>("/referral/me"),

  // This week's top accounts and the signed-in account's own position.
  leaderboard: () => authedRequest<Leaderboard>("/referral/leaderboard"),

  // Whether a code exists. Unauthenticated: the sign-up screen checks a code
  // before the account is created.
  validate: (code: string) =>
    apiRequest<{ valid: boolean }>(`/referral/validate/${encodeURIComponent(code.trim())}`),

  // Right after sign-up: uses the code the person entered, paying both sides.
  signUp: (referralCode: string) =>
    authedRequest<ReferralSignUpResult>("/referral/signup", { method: "POST", body: { referralCode } }),

  markWelcomeSeen: () => authedRequest<ReferralProfile>("/referral/welcome-seen", { method: "POST" }),
};
