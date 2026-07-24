import { Router } from 'express';
import { deleteAccount } from '../controllers/account.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const accountRouter = Router();

accountRouter.use(requireAuth);

accountRouter.delete('/', asyncHandler(deleteAccount));
