import { Router } from 'express';
import { listNotes, createNote, updateNote, deleteNote, cleanNote } from '../controllers/note.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const noteRouter = Router();

noteRouter.use(requireAuth);

noteRouter.get('/', asyncHandler(listNotes));
noteRouter.post('/', asyncHandler(createNote));
noteRouter.post('/clean', asyncHandler(cleanNote));
noteRouter.patch('/:id', asyncHandler(updateNote));
noteRouter.delete('/:id', asyncHandler(deleteNote));
