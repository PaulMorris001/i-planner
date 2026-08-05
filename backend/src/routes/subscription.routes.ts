import { Router } from 'express';
import { getSubscription, verifySubscription } from '../controllers/subscription.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const subscriptionRouter = Router();

subscriptionRouter.use(requireAuth);

subscriptionRouter.get('/', asyncHandler(getSubscription));
subscriptionRouter.post('/verify', asyncHandler(verifySubscription));
