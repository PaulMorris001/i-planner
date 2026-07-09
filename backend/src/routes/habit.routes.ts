import { Router } from 'express';
import { listHabits, createHabit, toggleHabitToday } from '../controllers/habit.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const habitRouter = Router();

habitRouter.use(requireAuth);

habitRouter.get('/', asyncHandler(listHabits));
habitRouter.post('/', asyncHandler(createHabit));
habitRouter.patch('/:id/toggle-today', asyncHandler(toggleHabitToday));
