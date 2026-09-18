import { Router } from 'express';
import { getSharedNotePreview, importSharedNote } from '../controllers/sharedNote.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const sharedNoteRouter = Router();

sharedNoteRouter.use(requireAuth);

sharedNoteRouter.get('/:token', asyncHandler(getSharedNotePreview));
sharedNoteRouter.post('/:token/import', asyncHandler(importSharedNote));
