import { Router } from 'express';
import { handleGoogleCalendarCallback } from '../controllers/googleOAuthCallback.controller';
import { asyncHandler } from '../utils/asyncHandler';

// Not nested under settingsRouter — that blanket-applies requireAuth, but this is
// a plain browser navigation with no auth header. Identity comes from the signed
// `state` param instead (see utils/googleOAuthState.ts).
export const googleOAuthRouter = Router();

googleOAuthRouter.get('/callback', asyncHandler(handleGoogleCalendarCallback));
