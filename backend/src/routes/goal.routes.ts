import { Router } from 'express';
import { listGoals, createGoal, updateGoal, deleteGoal, generateMilestones } from '../controllers/goal.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const goalRouter = Router();

goalRouter.use(requireAuth);

goalRouter.get('/', asyncHandler(listGoals));
goalRouter.post('/', asyncHandler(createGoal));
goalRouter.post('/generate-milestones', asyncHandler(generateMilestones));
goalRouter.patch('/:id', asyncHandler(updateGoal));
goalRouter.delete('/:id', asyncHandler(deleteGoal));
