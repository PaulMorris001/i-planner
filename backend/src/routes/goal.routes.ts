import { Router } from 'express';
import { listGoals, createGoal, updateGoal } from '../controllers/goal.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const goalRouter = Router();

goalRouter.use(requireAuth);

goalRouter.get('/', asyncHandler(listGoals));
goalRouter.post('/', asyncHandler(createGoal));
goalRouter.patch('/:id', asyncHandler(updateGoal));
