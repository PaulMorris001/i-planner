import { Router } from 'express';
import { getInbox, readAll, readOne } from '../controllers/inbox.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const inboxRouter = Router();

inboxRouter.use(requireAuth);

inboxRouter.get('/', asyncHandler(getInbox));
inboxRouter.post('/read-all', asyncHandler(readAll));
inboxRouter.post('/:id/read', asyncHandler(readOne));
