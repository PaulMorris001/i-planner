import { Router } from 'express';
import { getReferralLandingPage } from '../controllers/referralWeb.controller';

// Public, browser-facing page behind a shared referral link (/r/<code>). Not under /api or
// requireAuth: anyone with the link can open it, same shape as the shared-note pages.
export const referralWebRouter = Router();

referralWebRouter.get('/:code', getReferralLandingPage);
