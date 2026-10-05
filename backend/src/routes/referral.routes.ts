import { Router } from 'express';
import { getMyReferral, getWeeklyLeaderboard, markWelcomeSeen, signUpReferral, validateReferralCode } from '../controllers/referral.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const referralRouter = Router();

// Unauthenticated: the sign-up screen checks a code before the account exists.
referralRouter.get('/validate/:code', asyncHandler(validateReferralCode));

referralRouter.use(requireAuth);
referralRouter.get('/me', asyncHandler(getMyReferral));
referralRouter.get('/leaderboard', asyncHandler(getWeeklyLeaderboard));
referralRouter.post('/signup', asyncHandler(signUpReferral));
referralRouter.post('/welcome-seen', asyncHandler(markWelcomeSeen));
