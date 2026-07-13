import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  startGoogleCalendarConnect,
  disconnectGoogleCalendar,
} from '../controllers/settings.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get('/', asyncHandler(getSettings));
settingsRouter.patch('/', asyncHandler(updateSettings));
settingsRouter.post('/calendar/google/start', asyncHandler(startGoogleCalendarConnect));
settingsRouter.post('/calendar/google/disconnect', asyncHandler(disconnectGoogleCalendar));
