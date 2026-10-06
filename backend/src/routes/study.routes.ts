import { Router } from 'express';
import {
  createStudySession,
  deleteStudySession,
  getStudyState,
  getStudyStats,
  pauseStudy,
  resumeStudy,
  startStudy,
  stopStudy,
  updateStudySession,
} from '../controllers/study.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const studyRouter = Router();

studyRouter.use(requireAuth);

studyRouter.get('/state', asyncHandler(getStudyState));
studyRouter.get('/stats', asyncHandler(getStudyStats));
studyRouter.post('/sessions', asyncHandler(createStudySession));
studyRouter.patch('/sessions/:id', asyncHandler(updateStudySession));
studyRouter.delete('/sessions/:id', asyncHandler(deleteStudySession));
studyRouter.post('/sessions/:id/start', asyncHandler(startStudy));
studyRouter.post('/run/pause', asyncHandler(pauseStudy));
studyRouter.post('/run/resume', asyncHandler(resumeStudy));
studyRouter.post('/run/stop', asyncHandler(stopStudy));
