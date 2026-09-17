import { Router } from 'express';
import { listFolders, createFolder, updateFolder, deleteFolder } from '../controllers/folder.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const folderRouter = Router();

folderRouter.use(requireAuth);

folderRouter.get('/', asyncHandler(listFolders));
folderRouter.post('/', asyncHandler(createFolder));
folderRouter.patch('/:id', asyncHandler(updateFolder));
folderRouter.delete('/:id', asyncHandler(deleteFolder));
