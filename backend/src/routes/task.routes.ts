import { Router } from 'express';
import { listTasks, createTask, updateTask, deleteTask } from '../controllers/task.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const taskRouter = Router();

taskRouter.use(requireAuth);

taskRouter.get('/', asyncHandler(listTasks));
taskRouter.post('/', asyncHandler(createTask));
taskRouter.patch('/:id', asyncHandler(updateTask));
taskRouter.delete('/:id', asyncHandler(deleteTask));
