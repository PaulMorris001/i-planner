import { Router } from 'express';
import { handleMicrosoftCalendarCallback } from '../controllers/microsoftOAuthCallback.controller';
import { asyncHandler } from '../utils/asyncHandler';

// Not nested under settingsRouter — that blanket-applies requireAuth, but this is
// a plain browser navigation with no auth header. Identity comes from the signed
// `state` param instead (see utils/googleOAuthState.ts).
export const microsoftOAuthRouter = Router();

microsoftOAuthRouter.get('/callback', asyncHandler(handleMicrosoftCalendarCallback));
