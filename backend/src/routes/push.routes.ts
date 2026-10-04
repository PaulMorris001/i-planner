import { Router } from 'express';
import { registerPushToken, unregisterPushToken } from '../controllers/push.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const pushRouter = Router();

pushRouter.use(requireAuth);

pushRouter.post('/tokens', asyncHandler(registerPushToken));
pushRouter.delete('/tokens', asyncHandler(unregisterPushToken));
