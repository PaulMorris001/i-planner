import { Router } from 'express';
import { getPlan, savePlan } from '../controllers/plan.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const planRouter = Router();

planRouter.use(requireAuth);

planRouter.get('/:pathType', asyncHandler(getPlan));
planRouter.put('/:pathType', asyncHandler(savePlan));
