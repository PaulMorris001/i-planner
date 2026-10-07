import { Router } from 'express';
import { declineInviteWebPage, getInviteWebPage } from '../controllers/collaboration.controller';
import { asyncHandler } from '../utils/asyncHandler';

// Public pages (no sign-in) behind the link in the invitation email, mounted in app.ts at
// /invite. Opening the page changes nothing; declining is a POST.
export const inviteWebRouter = Router();

inviteWebRouter.get('/:token', asyncHandler(getInviteWebPage));
inviteWebRouter.post('/:token/decline', asyncHandler(declineInviteWebPage));
