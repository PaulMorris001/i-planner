import { Router } from 'express';
import { listCoachMessages, sendCoachMessage } from '../controllers/coach.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const coachRouter = Router();

coachRouter.use(requireAuth);

coachRouter.get('/:mode', asyncHandler(listCoachMessages));
coachRouter.post('/:mode', asyncHandler(sendCoachMessage));
