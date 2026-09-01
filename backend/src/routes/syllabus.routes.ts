import { Router } from 'express';
import { listSyllabi, extractSyllabusHandler, createSyllabus, updateSyllabus, deleteSyllabus } from '../controllers/syllabus.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const syllabusRouter = Router();

syllabusRouter.use(requireAuth);

syllabusRouter.get('/', asyncHandler(listSyllabi));
syllabusRouter.post('/extract', asyncHandler(extractSyllabusHandler));
syllabusRouter.post('/', asyncHandler(createSyllabus));
syllabusRouter.patch('/:id', asyncHandler(updateSyllabus));
syllabusRouter.delete('/:id', asyncHandler(deleteSyllabus));
