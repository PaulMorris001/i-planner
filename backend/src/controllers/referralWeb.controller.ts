import { Request, Response } from 'express';
import { normalizeReferralCode } from '../services/referral';
import { REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH } from '../constants/referral';
import { buildReferralLandingPage, buildReferralNotFoundPage, platformFromUserAgent } from '../services/referralLinkHtml';

const WELL_FORMED_CODE = new RegExp(`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

// GET /r/<code>: the page behind a shared referral link. If the app is installed (and the phone
// has verified this domain), the phone opens the app directly and this is never reached. This is
// what everyone else sees: the invitation, the code, and the right store for their phone.
export function getReferralLandingPage(req: Request, res: Response) {
  const code = normalizeReferralCode(req.params.code);
  // The code is only ever shown or placed in a link after this check, so nothing a visitor types
  // into the address bar can end up in the page.
  if (!code || !WELL_FORMED_CODE.test(code)) {
    res.status(404).type('html').send(buildReferralNotFoundPage());
    return;
  }
  res.type('html').send(buildReferralLandingPage(code, platformFromUserAgent(req.get('user-agent'))));
}
