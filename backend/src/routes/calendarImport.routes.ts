import { Router } from 'express';
import {
  listImportedEvents,
  importGoogleEvents,
  importAppleEvents,
  deleteImportedEvent,
} from '../controllers/calendarImport.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const calendarImportRouter = Router();

calendarImportRouter.use(requireAuth);

calendarImportRouter.get('/imported', asyncHandler(listImportedEvents));
calendarImportRouter.post('/import/google', asyncHandler(importGoogleEvents));
calendarImportRouter.post('/import/apple', asyncHandler(importAppleEvents));
calendarImportRouter.delete('/imported/:id', asyncHandler(deleteImportedEvent));
