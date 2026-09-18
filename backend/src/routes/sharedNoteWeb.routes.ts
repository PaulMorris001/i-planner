import { Router } from 'express';
import { getSharedNoteWebPage } from '../controllers/sharedNote.controller';
import { asyncHandler } from '../utils/asyncHandler';

// Not nested under the /api router or requireAuth — this is a plain browser
// page anyone with the link can open, same shape as googleOAuth.routes.ts's
// callback route. Mounted directly in app.ts at /shared, alongside the
// existing static-file serving, so the link stays short and browser-friendly
// (e.g. https://.../shared/<token>) rather than living under /api.
export const sharedNoteWebRouter = Router();

sharedNoteWebRouter.get('/:token', asyncHandler(getSharedNoteWebPage));
