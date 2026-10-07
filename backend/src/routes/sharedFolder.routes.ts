import { Router } from 'express';
import { getSharedFolderPreview, importSharedFolder } from '../controllers/sharedFolder.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const sharedFolderRouter = Router();

sharedFolderRouter.use(requireAuth);

sharedFolderRouter.get('/:token', asyncHandler(getSharedFolderPreview));
sharedFolderRouter.post('/:token/import', asyncHandler(importSharedFolder));
