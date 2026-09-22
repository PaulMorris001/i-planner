import { Router } from 'express';
import { sendWelcomeEmail, sendLoginNotifyEmail, forgotPassword } from '../controllers/authEmail.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const authEmailRouter = Router();

// Unauthenticated — the user isn't signed in yet. Declared before the
// requireAuth blanket below applies to the rest of this router.
authEmailRouter.post('/forgot-password', asyncHandler(forgotPassword));

authEmailRouter.post('/welcome', requireAuth, asyncHandler(sendWelcomeEmail));
authEmailRouter.post('/login-notify', requireAuth, asyncHandler(sendLoginNotifyEmail));
