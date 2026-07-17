import { Router } from 'express';
import { getPlan, savePlan, generateExamTopicsHandler } from '../controllers/plan.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const planRouter = Router();

planRouter.use(requireAuth);

planRouter.post('/exam/generate-topics', asyncHandler(generateExamTopicsHandler));
planRouter.get('/:pathType', asyncHandler(getPlan));
planRouter.put('/:pathType', asyncHandler(savePlan));
