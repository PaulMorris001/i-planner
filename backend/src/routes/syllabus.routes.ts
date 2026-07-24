import { Router } from 'express';
import { listSyllabi, extractSyllabusHandler, createSyllabus } from '../controllers/syllabus.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const syllabusRouter = Router();

syllabusRouter.use(requireAuth);

syllabusRouter.get('/', asyncHandler(listSyllabi));
syllabusRouter.post('/extract', asyncHandler(extractSyllabusHandler));
syllabusRouter.post('/', asyncHandler(createSyllabus));
