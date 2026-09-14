import { Router } from 'express';
import { extractTimetableHandler } from '../controllers/timetable.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const timetableRouter = Router();

timetableRouter.use(requireAuth);

timetableRouter.post('/extract', asyncHandler(extractTimetableHandler));
