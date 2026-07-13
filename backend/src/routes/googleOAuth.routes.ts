import { Router } from 'express';
import { handleGoogleCalendarCallback } from '../controllers/googleOAuthCallback.controller';
import { asyncHandler } from '../utils/asyncHandler';

// Deliberately NOT nested under settingsRouter — that router blanket-applies
// requireAuth, but Google's redirect here is a plain browser navigation with no
// auth header. Identity comes from the signed `state` param instead (see
// utils/googleOAuthState.ts).
export const googleOAuthRouter = Router();

googleOAuthRouter.get('/callback', asyncHandler(handleGoogleCalendarCallback));
