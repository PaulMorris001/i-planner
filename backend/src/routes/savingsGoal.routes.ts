import { Router } from 'express';
import { listSavingsGoals, createSavingsGoal, updateSavingsGoal, deleteSavingsGoal } from '../controllers/savingsGoal.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const savingsGoalRouter = Router();

savingsGoalRouter.use(requireAuth);

savingsGoalRouter.get('/', asyncHandler(listSavingsGoals));
savingsGoalRouter.post('/', asyncHandler(createSavingsGoal));
savingsGoalRouter.patch('/:id', asyncHandler(updateSavingsGoal));
savingsGoalRouter.delete('/:id', asyncHandler(deleteSavingsGoal));
