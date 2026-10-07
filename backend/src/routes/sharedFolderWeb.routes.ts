import { Router } from 'express';
import { getSharedFolderWebPage } from '../controllers/sharedFolder.controller';
import { asyncHandler } from '../utils/asyncHandler';

// A plain browser page anyone with the link can open (no sign-in), mounted in app.ts at
// /f like the note pages are at /n. Same reasoning as sharedNoteWeb.routes.ts.
export const sharedFolderWebRouter = Router();

sharedFolderWebRouter.get('/:token', asyncHandler(getSharedFolderWebPage));
